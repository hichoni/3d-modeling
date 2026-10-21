package io.github.hichoni.clickstudio;

import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.WebView;

import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.Closeable;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.MulticastSocket;
import java.net.Socket;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;

/**
 * Native sockets for the page, as JSON messages over the injected {@code ClickNative} object
 * (web side: src/direct/android-bridge.js; Node stand-in for tests: tests/helpers/fake-android-native.cjs).
 * Limited to the A1 mini's LAN protocol, as in the Chromebook app's shell (src/iwa-shell.js): private IPv4 only,
 * TCP 8883 (MQTT), 990 (FTPS) and 6000, plus FTPS passive data ports while an FTPS connection to that host is open;
 * UDP bound to 2021/1990 for SSDP, sends only to the SSDP group or a private address on those ports.
 */
final class SocketBridge implements WebViewCompat.WebMessageListener {
    private static final String GROUP = "239.255.255.250";
    private static final Pattern IPV4 = Pattern.compile("^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$");

    private final Context context;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService pool = Executors.newCachedThreadPool();
    private final Map<Integer, Entry> sockets = new ConcurrentHashMap<>();
    private final Map<String, Integer> ftpsOpen = new ConcurrentHashMap<>();
    private final AtomicInteger nextSid = new AtomicInteger(1);
    private WifiManager.MulticastLock multicastLock;

    SocketBridge(Context context) {
        this.context = context.getApplicationContext();
    }

    static String appVersion(Context c) {
        try {
            return c.getPackageManager().getPackageInfo(c.getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "?";
        }
    }

    private static final class Entry {
        final int sid;
        final JavaScriptReplyProxy proxy;
        final Socket tcp;
        final DatagramSocket udp;
        final String host;
        final int port;
        final ExecutorService writer = Executors.newSingleThreadExecutor();
        volatile boolean closed;

        Entry(int sid, JavaScriptReplyProxy proxy, Socket tcp, DatagramSocket udp, String host, int port) {
            this.sid = sid;
            this.proxy = proxy;
            this.tcp = tcp;
            this.udp = udp;
            this.host = host;
            this.port = port;
        }
    }

    @Override
    public void onPostMessage(WebView view, WebMessageCompat message, Uri sourceOrigin, boolean isMainFrame, JavaScriptReplyProxy proxy) {
        if (!isMainFrame || message.getType() != WebMessageCompat.TYPE_STRING || message.getData() == null) return;
        JSONObject m;
        try {
            m = new JSONObject(message.getData());
        } catch (JSONException e) {
            return;
        }
        // Messages for one socket run in order on that socket's own thread; opening sockets may block, so it goes to the pool.
        Entry e = sockets.get(m.optInt("sid", -1));
        Runnable task = () -> handle(m, proxy);
        if (e != null) {
            try {
                e.writer.execute(task);
                return;
            } catch (java.util.concurrent.RejectedExecutionException closed) {
                // The socket already closed; handle() answers that.
            }
        }
        pool.execute(task);
    }

    private void handle(JSONObject m, JavaScriptReplyProxy proxy) {
        int id = m.optInt("id");
        String op = m.optString("op");
        Entry e = sockets.get(m.optInt("sid", -1));
        try {
            switch (op) {
                case "hello":
                    // A new page says hello before it opens anything; connections left by the previous page close.
                    closeAll();
                    reply(proxy, id, ok().put("version", appVersion(context)));
                    return;
                case "tcp":
                    openTcp(m, proxy, id);
                    return;
                case "write": {
                    if (e == null || e.tcp == null || e.closed) {
                        fail(proxy, id, "NetworkError", "프린터와의 연결이 이미 닫혔습니다.");
                        return;
                    }
                    byte[] bytes = Base64.decode(m.optString("data"), Base64.NO_WRAP);
                    try {
                        OutputStream out = e.tcp.getOutputStream();
                        out.write(bytes);
                        out.flush();
                    } catch (IOException err) {
                        fail(proxy, id, "NetworkError", "프린터로 데이터를 보내지 못했습니다.");
                        return;
                    }
                    reply(proxy, id, ok());
                    return;
                }
                case "shutdown":
                    if (e != null && e.tcp != null) try {
                        e.tcp.shutdownOutput();
                    } catch (IOException ignored) {
                    }
                    reply(proxy, id, ok());
                    return;
                case "close":
                    if (e != null) close(e);
                    reply(proxy, id, ok());
                    return;
                case "udp":
                    openUdp(m.optJSONObject("options"), proxy, id);
                    return;
                case "send": {
                    String host = m.optString("host");
                    int port = m.optInt("port");
                    if (e == null || e.udp == null || !(GROUP.equals(host) || privateIPv4(host)) || (port != 2021 && port != 1990)) {
                        fail(proxy, id, "NotAllowedError", "이 UDP 사용은 프린터 검색에 쓰지 않습니다.");
                        return;
                    }
                    byte[] data = Base64.decode(m.optString("data"), Base64.NO_WRAP);
                    e.udp.send(new DatagramPacket(data, data.length, InetAddress.getByName(host), port));
                    reply(proxy, id, ok());
                    return;
                }
                case "join":
                case "leave":
                    if (e == null || !(e.udp instanceof MulticastSocket) || !GROUP.equals(m.optString("group"))) {
                        fail(proxy, id, "NotAllowedError", "멀티캐스트 그룹을 사용할 수 없습니다.");
                        return;
                    }
                    if (op.equals("join")) ((MulticastSocket) e.udp).joinGroup(InetAddress.getByName(GROUP));
                    else ((MulticastSocket) e.udp).leaveGroup(InetAddress.getByName(GROUP));
                    reply(proxy, id, ok());
                    return;
                case "save":
                    reply(proxy, id, ok().put("path", save(m.optString("name"), m.optString("mime"), Base64.decode(m.optString("data"), Base64.NO_WRAP))));
                    return;
                default:
                    fail(proxy, id, "NotSupportedError", "지원하지 않는 요청입니다.");
            }
        } catch (Exception err) {
            fail(proxy, id, "NetworkError", err.getMessage() == null ? "연결하지 못했습니다." : err.getMessage());
        }
    }

    private void openTcp(JSONObject m, JavaScriptReplyProxy proxy, int id) throws JSONException {
        String host = m.optString("host");
        int port = m.optInt("port");
        if (!allowTcp(host, port)) {
            fail(proxy, id, "NotAllowedError", "이 주소·포트는 프린터 연결에 쓰지 않습니다.");
            return;
        }
        Socket s = new Socket();
        try {
            s.setTcpNoDelay(m.optBoolean("noDelay"));
            s.setKeepAlive(true);
            s.connect(new InetSocketAddress(InetAddress.getByName(host), port), 10000);
        } catch (IOException err) {
            quiet(s);
            fail(proxy, id, "NetworkError", "이 주소의 프린터에 연결하지 못했습니다.");
            return;
        }
        Entry e = new Entry(nextSid.getAndIncrement(), proxy, s, null, host, port);
        sockets.put(e.sid, e);
        if (port == 990) ftpsOpen.merge(host, 1, Integer::sum);
        JSONObject info = new JSONObject().put("localAddress", s.getLocalAddress().getHostAddress()).put("localPort", s.getLocalPort())
                .put("remoteAddress", host).put("remotePort", port);
        reply(proxy, id, ok().put("sid", e.sid).put("info", info));
        pool.execute(() -> {
            byte[] buf = new byte[65536];
            try {
                InputStream in = s.getInputStream();
                for (int n; (n = in.read(buf)) >= 0; ) {
                    if (n > 0) event(e, new JSONObject().put("ev", "data").put("data", Base64.encodeToString(buf, 0, n, Base64.NO_WRAP)));
                }
                event(e, new JSONObject().put("ev", "end"));
            } catch (Exception err) {
                if (!e.closed) try {
                    event(e, new JSONObject().put("ev", "error").put("message", "프린터와의 연결이 끊겼습니다."));
                } catch (JSONException ignored) {
                }
            } finally {
                release(e);
            }
        });
    }

    private void openUdp(JSONObject o, JavaScriptReplyProxy proxy, int id) throws Exception {
        if (o == null) o = new JSONObject();
        DatagramSocket socket;
        JSONObject info = new JSONObject();
        boolean multicast = false;
        if (o.has("localPort")) {
            int port = o.optInt("localPort");
            if (!"0.0.0.0".equals(o.optString("localAddress")) || (port != 2021 && port != 1990)) {
                fail(proxy, id, "NotAllowedError", "이 UDP 사용은 프린터 검색에 쓰지 않습니다.");
                return;
            }
            MulticastSocket ms = new MulticastSocket(null);
            ms.setReuseAddress(true);
            ms.bind(new InetSocketAddress(port));
            socket = ms;
            multicast = true;
            info.put("localAddress", "0.0.0.0").put("localPort", port);
            holdMulticast(true);
        } else {
            String host = o.optString("remoteAddress");
            int port = o.optInt("remotePort");
            if (!privateIPv4(host) || (port != 9 && port != 2021 && port != 1990)) {
                fail(proxy, id, "NotAllowedError", "이 UDP 사용은 프린터 검색에 쓰지 않습니다.");
                return;
            }
            // Connecting a UDP socket sends nothing; it only reveals which local address faces the printer's Wi-Fi.
            socket = new DatagramSocket();
            socket.connect(InetAddress.getByName(host), port);
            info.put("localAddress", socket.getLocalAddress().getHostAddress()).put("localPort", socket.getLocalPort())
                    .put("remoteAddress", host).put("remotePort", port);
        }
        Entry e = new Entry(nextSid.getAndIncrement(), proxy, null, socket, null, 0);
        sockets.put(e.sid, e);
        reply(proxy, id, ok().put("sid", e.sid).put("multicast", multicast).put("info", info));
        if (!multicast) return;
        DatagramSocket bound = socket;
        pool.execute(() -> {
            byte[] buf = new byte[8192];
            try {
                while (!e.closed) {
                    DatagramPacket p = new DatagramPacket(buf, buf.length);
                    bound.receive(p);
                    event(e, new JSONObject().put("ev", "udp").put("data", Base64.encodeToString(p.getData(), 0, p.getLength(), Base64.NO_WRAP))
                            .put("host", p.getAddress().getHostAddress()).put("port", p.getPort()));
                }
            } catch (Exception ignored) {
            } finally {
                release(e);
            }
        });
    }

    private synchronized void holdMulticast(boolean on) {
        WifiManager wifi = (WifiManager) context.getSystemService(Context.WIFI_SERVICE);
        if (wifi == null) return;
        if (multicastLock == null) {
            multicastLock = wifi.createMulticastLock("click-studio-ssdp");
            multicastLock.setReferenceCounted(true);
        }
        if (on) multicastLock.acquire();
        else if (multicastLock.isHeld()) multicastLock.release();
    }

    private String save(String name, String mime, byte[] data) throws IOException {
        String safe = name.replaceAll("[\\\\/:*?\"<>|]", "_");
        if (safe.isEmpty()) safe = "click-studio-file";
        ContentValues v = new ContentValues();
        v.put(MediaStore.MediaColumns.DISPLAY_NAME, safe);
        v.put(MediaStore.MediaColumns.MIME_TYPE, mime.isEmpty() ? "application/octet-stream" : mime);
        v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/ClickStudio");
        Uri uri = context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
        if (uri == null) throw new IOException("Download 폴더에 저장하지 못했습니다.");
        try (OutputStream out = context.getContentResolver().openOutputStream(uri)) {
            if (out == null) throw new IOException("Download 폴더에 저장하지 못했습니다.");
            out.write(data);
        }
        return Environment.DIRECTORY_DOWNLOADS + "/ClickStudio/" + safe;
    }

    private boolean allowTcp(String host, int port) {
        if (!privateIPv4(host) || port < 1 || port > 65535) return false;
        if (port == 8883 || port == 990 || port == 6000) return true;
        Integer open = ftpsOpen.get(host);
        return port >= 1024 && open != null && open > 0;
    }

    static boolean privateIPv4(String ip) {
        java.util.regex.Matcher m = IPV4.matcher(ip == null ? "" : ip);
        if (!m.matches()) return false;
        int[] p = new int[4];
        for (int i = 0; i < 4; i++) {
            p[i] = Integer.parseInt(m.group(i + 1));
            if (p[i] > 255) return false;
        }
        return p[0] == 10 || p[0] == 192 && p[1] == 168 || p[0] == 172 && p[1] >= 16 && p[1] <= 31;
    }

    private void close(Entry e) {
        if (e.closed) return;
        e.closed = true;
        quiet(e.tcp);
        quiet(e.udp);
        release(e);
    }

    private void release(Entry e) {
        if (sockets.remove(e.sid) == null) return;
        e.closed = true;
        if (e.tcp != null && e.port == 990) ftpsOpen.computeIfPresent(e.host, (k, n) -> n > 1 ? n - 1 : null);
        if (e.udp instanceof MulticastSocket) holdMulticast(false);
        quiet(e.tcp);
        quiet(e.udp);
        e.writer.shutdown();
    }

    void closeAll() {
        for (Entry e : sockets.values()) close(e);
    }

    private static void quiet(Closeable c) {
        if (c == null) return;
        try {
            c.close();
        } catch (IOException ignored) {
        }
    }

    private static JSONObject ok() throws JSONException {
        return new JSONObject().put("ok", true);
    }

    private void fail(JavaScriptReplyProxy proxy, int id, String name, String error) {
        try {
            reply(proxy, id, new JSONObject().put("ok", false).put("name", name).put("error", error));
        } catch (JSONException ignored) {
        }
    }

    private void reply(JavaScriptReplyProxy proxy, int id, JSONObject o) throws JSONException {
        post(proxy, o.put("id", id).toString());
    }

    private void event(Entry e, JSONObject o) throws JSONException {
        post(e.proxy, o.put("sid", e.sid).toString());
    }

    // JavaScriptReplyProxy is used on the UI thread; a proxy of a page that is gone ignores the message.
    private void post(JavaScriptReplyProxy proxy, String text) {
        main.post(() -> {
            try {
                proxy.postMessage(text);
            } catch (Exception ignored) {
            }
        });
    }
}

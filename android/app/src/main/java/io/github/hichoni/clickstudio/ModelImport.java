package io.github.hichoni.clickstudio;

import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Arrays;
import java.util.List;

/**
 * 3MF projects handed to the app: MakerWorld's "Bambu Studio로 열기" link (bambustudio://open?file=URL, or
 * bambustudioopen://URL) or a .3mf opened from Files. The file is fetched here and kept until the Studio page takes it
 * (op "takeImport" in {@link SocketBridge}).
 */
final class ModelImport {
    static final long MAX_BYTES = 120L * 1024 * 1024;
    // The download hosts Bambu Studio itself trusts for MakerWorld links (GUI_App.cpp is_trusted_model_download_url).
    private static final List<String> TRUSTED = Arrays.asList("or-cloud-makerlab-prod.s3-accelerate.amazonaws.com",
            "sh-makerlab-prod.oss-cn-shanghai.aliyuncs.com", "public-cdn.bblmw.com", "makerworld.bblmw.cn", "makerworld.bblmw.com");

    static final class Pending {
        final String name;
        final byte[] data;

        Pending(String name, byte[] data) {
            this.name = name;
            this.data = data;
        }
    }

    private static Pending pending;

    static synchronized void put(Pending p) {
        pending = p;
    }

    static synchronized Pending take() {
        Pending p = pending;
        pending = null;
        return p;
    }

    /** True when the intent carries a 3MF for the app (it still needs {@link #fetch}). */
    static boolean wants(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction()) || intent.getData() == null) return false;
        String scheme = intent.getData().getScheme();
        return "bambustudio".equals(scheme) || "bambustudioopen".equals(scheme) || "content".equals(scheme);
    }

    /** Downloads or reads the 3MF; throws with a message for the visitor when it cannot. */
    static Pending fetch(Intent intent, ContentResolver resolver) throws IOException {
        Uri data = intent.getData();
        if ("content".equals(data.getScheme())) {
            String name = data.getLastPathSegment();
            try (Cursor c = resolver.query(data, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                if (c != null && c.moveToFirst() && c.getString(0) != null) name = c.getString(0);
            } catch (RuntimeException ignored) {
            }
            try (InputStream in = resolver.openInputStream(data)) {
                if (in == null) throw new IOException("파일을 열지 못했어요.");
                return new Pending(fileName(name), readAll(in));
            }
        }
        String target = downloadUrl(data);
        if (target == null) throw new IOException("MakerWorld 링크에서 파일 주소를 찾지 못했어요.");
        return download(target, 0);
    }

    static String downloadUrl(Uri link) {
        String raw = link.toString(), url;
        if ("bambustudioopen".equals(link.getScheme())) url = decode(raw.substring("bambustudioopen://".length()));
        else {
            int i = raw.indexOf("file=");
            url = i < 0 ? null : decode(raw.substring(i + 5));
        }
        return url != null && trusted(url) ? url : null;
    }

    static boolean trusted(String url) {
        try {
            URL u = new URL(url);
            return "https".equals(u.getProtocol()) && u.getUserInfo() == null && TRUSTED.contains(u.getHost().toLowerCase());
        } catch (IOException e) {
            return false;
        }
    }

    private static Pending download(String url, int redirects) throws IOException {
        if (redirects > 4 || !trusted(url)) throw new IOException("MakerWorld가 아닌 곳의 파일은 열지 않아요.");
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setInstanceFollowRedirects(false);
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        try {
            int code = c.getResponseCode();
            if (code >= 300 && code < 400 && c.getHeaderField("Location") != null)
                return download(new URL(new URL(url), c.getHeaderField("Location")).toString(), redirects + 1);
            if (code != 200) throw new IOException("MakerWorld에서 파일을 받지 못했어요. (" + code + ")");
            if (c.getContentLengthLong() > MAX_BYTES) throw new IOException("3MF는 120MB까지 열 수 있어요.");
            try (InputStream in = c.getInputStream()) {
                return new Pending(fileName(Uri.parse(url).getLastPathSegment()), readAll(in));
            }
        } finally {
            c.disconnect();
        }
    }

    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[65536];
        for (int n; (n = in.read(buf)) >= 0; ) {
            out.write(buf, 0, n);
            if (out.size() > MAX_BYTES) throw new IOException("3MF는 120MB까지 열 수 있어요.");
        }
        return out.toByteArray();
    }

    private static String fileName(String segment) {
        String name = segment == null ? "" : segment.replaceAll("[\\\\/:*?\"<>|]", "_");
        if (name.isEmpty()) name = "makerworld";
        if (!name.toLowerCase().endsWith(".3mf")) name += ".3mf";
        return name.length() > 80 ? name.substring(name.length() - 80) : name;
    }

    // Percent-decoding only ('+' stays '+'), as Bambu Studio's url_decode does for these links.
    private static String decode(String s) {
        return Uri.decode(s);
    }
}

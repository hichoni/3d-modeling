package io.github.hichoni.clickstudio;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import java.util.Arrays;
import java.util.HashSet;

/**
 * Tablet app for the keycap booth: shows the live website (so it always runs the latest deployed code) and lends it
 * native sockets through {@link SocketBridge}. If the site cannot be reached, the copy packaged in the app opens.
 */
public class MainActivity extends Activity {
    static final String SITE_HOST = "hichoni.github.io";
    static final String SITE = "https://" + SITE_HOST + "/3d-modeling/";
    static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final int PICK_FILES = 1;

    private WebView web;
    private SocketBridge bridge;
    private ValueCallback<Uri[]> fileCallback;
    private boolean offline;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportMultipleWindows(false);
        s.setUserAgentString(s.getUserAgentString() + " ClickStudioAndroid/" + SocketBridge.appVersion(this));

        bridge = new SocketBridge(this);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            // Only pages from the site (or the packaged copy) see the bridge object.
            WebViewCompat.addWebMessageListener(web, "ClickNative",
                    new HashSet<>(Arrays.asList("https://" + SITE_HOST, "https://" + ASSET_HOST)), bridge);
        } else {
            Toast.makeText(this, "Android System WebView를 업데이트해야 프린터에 연결할 수 있어요.", Toast.LENGTH_LONG).show();
        }

        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assets.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (inApp(u)) return false;
                // Everything else (Bambu Lab pages, guides on other sites) opens in the tablet's browser.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (ActivityNotFoundException ignored) {
                }
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                bridge.closeAll();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) openPackagedCopy(request.getUrl());
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 500) openPackagedCopy(request.getUrl());
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try {
                    startActivityForResult(Intent.createChooser(pick, "파일 선택"), PICK_FILES);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(SITE);
    }

    static boolean inApp(Uri u) {
        if (!"https".equals(u.getScheme())) return false;
        String host = u.getHost(), path = u.getPath() == null ? "" : u.getPath();
        return SITE_HOST.equals(host) && (path.equals("/3d-modeling") || path.startsWith("/3d-modeling/"))
                || ASSET_HOST.equals(host) && path.startsWith("/assets/web/");
    }

    private void openPackagedCopy(Uri failed) {
        if (offline || !SITE_HOST.equals(failed.getHost())) return;
        offline = true;
        String page = failed.getPath() != null && failed.getPath().endsWith("studio.html") ? "studio.html" : "index.html";
        Toast.makeText(this, "사이트에 연결하지 못해 앱에 들어 있는 화면으로 열어요.", Toast.LENGTH_LONG).show();
        web.loadUrl("https://" + ASSET_HOST + "/assets/web/" + page);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != PICK_FILES || fileCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                result = new Uri[data.getClipData().getItemCount()];
                for (int i = 0; i < result.length; i++) result[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data.getData() != null) {
                result = new Uri[]{data.getData()};
            }
        }
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        bridge.closeAll();
        web.destroy();
        super.onDestroy();
    }
}

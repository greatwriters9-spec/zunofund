package com.zunofund.mobile;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        webView.setBackgroundColor(Color.parseColor("#05080F"));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        WebSettings settings = webView.getSettings();
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true);
        }
    }
}

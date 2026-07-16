package fr.robinjoseph.soufflet;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SouffletUpdater")
public class SouffletUpdaterPlugin extends Plugin {
    private long pendingDownloadId = -1;

    private final BroadcastReceiver downloadReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            long completedId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
            if (completedId != pendingDownloadId) return;
            DownloadManager manager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
            Uri apk = manager.getUriForDownloadedFile(completedId);
            if (apk == null) return;

            Intent installer = new Intent(Intent.ACTION_VIEW);
            installer.setDataAndType(apk, "application/vnd.android.package-archive");
            installer.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            context.startActivity(installer);
            JSObject result = new JSObject();
            result.put("downloadId", completedId);
            notifyListeners("installPromptOpened", result);
            pendingDownloadId = -1;
        }
    };

    @Override
    public void load() {
        ContextCompat.registerReceiver(
            getContext(),
            downloadReceiver,
            new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
            ContextCompat.RECEIVER_NOT_EXPORTED
        );
    }

    @PluginMethod
    public void canInstallPackages(PluginCall call) {
        boolean allowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.O
            || getContext().getPackageManager().canRequestPackageInstalls();
        JSObject result = new JSObject();
        result.put("allowed", allowed);
        call.resolve(result);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent settings = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(settings);
        }
        call.resolve();
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        String fileName = call.getString("fileName", "soufflet-android.apk");
        if (url == null) {
            call.reject("Adresse de mise à jour manquante.");
            return;
        }
        Uri uri = Uri.parse(url);
        if (!"https".equalsIgnoreCase(uri.getScheme()) || !"github.com".equalsIgnoreCase(uri.getHost())) {
            call.reject("La mise à jour doit provenir de github.com.");
            return;
        }
        if (!fileName.matches("^soufflet-android-v?[0-9]+\\.[0-9]+\\.[0-9]+\\.apk$")) {
            call.reject("Nom d’APK non reconnu.");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            call.reject("Autorise d’abord Soufflet à installer des applications.");
            return;
        }

        DownloadManager.Request request = new DownloadManager.Request(uri)
            .setTitle("Mise à jour de Soufflet")
            .setDescription(fileName)
            .setMimeType("application/vnd.android.package-archive")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_DOWNLOADS, fileName);
        DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        pendingDownloadId = manager.enqueue(request);
        JSObject result = new JSObject();
        result.put("downloadId", pendingDownloadId);
        call.resolve(result);
    }

    @Override
    protected void handleOnDestroy() {
        try {
            getContext().unregisterReceiver(downloadReceiver);
        } catch (IllegalArgumentException ignored) {
            // Receiver already removed by Android.
        }
    }
}

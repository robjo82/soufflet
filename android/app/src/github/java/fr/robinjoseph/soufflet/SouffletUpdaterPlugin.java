package fr.robinjoseph.soufflet;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.database.Cursor;
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
    private static final String PREFERENCES = "soufflet_updater";
    private static final String PENDING_DOWNLOAD = "pending_download";
    private long pendingDownloadId = -1;

    private final BroadcastReceiver downloadReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            long completedId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
            if (completedId != pendingDownloadId) return;
            openCompletedDownload(completedId);
        }
    };

    @Override
    public void load() {
        pendingDownloadId = preferences().getLong(PENDING_DOWNLOAD, -1);
        ContextCompat.registerReceiver(
            getContext(),
            downloadReceiver,
            new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
            ContextCompat.RECEIVER_EXPORTED
        );
        if (pendingDownloadId != -1) openCompletedDownload(pendingDownloadId);
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    private void rememberPendingDownload(long downloadId) {
        pendingDownloadId = downloadId;
        preferences().edit().putLong(PENDING_DOWNLOAD, downloadId).apply();
    }

    private void forgetPendingDownload() {
        pendingDownloadId = -1;
        preferences().edit().remove(PENDING_DOWNLOAD).apply();
    }

    private void openCompletedDownload(long downloadId) {
        DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        try (Cursor cursor = manager.query(new DownloadManager.Query().setFilterById(downloadId))) {
            if (cursor == null || !cursor.moveToFirst()) return;
            int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            if (status == DownloadManager.STATUS_FAILED) {
                forgetPendingDownload();
                JSObject result = new JSObject();
                result.put("downloadId", downloadId);
                notifyListeners("updateFailed", result);
                return;
            }
            if (status != DownloadManager.STATUS_SUCCESSFUL) return;
        }

        Uri apk = manager.getUriForDownloadedFile(downloadId);
        if (apk == null) {
            forgetPendingDownload();
            return;
        }
        Intent installer = new Intent(Intent.ACTION_VIEW);
        installer.setDataAndType(apk, "application/vnd.android.package-archive");
        installer.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        getContext().startActivity(installer);
        JSObject result = new JSObject();
        result.put("downloadId", downloadId);
        notifyListeners("installPromptOpened", result);
        forgetPendingDownload();
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
        rememberPendingDownload(manager.enqueue(request));
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

package com.meteor.download;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.webkit.MimeTypeMap;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * 把下载目录里的文件以 content:// URI 暴露给本 App 内播放器和系统分享，
 * 不需要 FileProvider（避免引入 AndroidX）。
 */
public class FileBridge extends ContentProvider {

    public static final String AUTHORITY = "com.meteor.download.files";

    public static Uri uriFor(String absolutePath) {
        return Uri.parse("content://" + AUTHORITY + "/read?p=" + Uri.encode(absolutePath));
    }

    public static String mimeOf(String path) {
        if (path == null) return "application/octet-stream";
        int dot = path.lastIndexOf('.');
        String ext = dot >= 0 ? path.substring(dot + 1).toLowerCase() : "";
        String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return mime == null ? "application/octet-stream" : mime;
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    private File fileFor(Uri uri) {
        String p = uri.getQueryParameter("p");
        if (p == null || p.isEmpty()) return null;
        try {
            File f = new File(p).getCanonicalFile();
            File downloads = Environment.getExternalStoragePublicDirectory(
                    Environment.DIRECTORY_DOWNLOADS).getCanonicalFile();
            if (f.getPath().equals(downloads.getPath())
                    || f.getPath().startsWith(downloads.getPath() + File.separator)) {
                return f;
            }
            File ext = getContext() == null ? null : getContext().getExternalFilesDir(null);
            if (ext != null && f.getPath().startsWith(ext.getCanonicalPath())) return f;
        } catch (Exception ignored) {
        }
        return null;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection,
                        String[] selectionArgs, String sortOrder) {
        File f = fileFor(uri);
        if (f == null || !f.exists()) return null;
        MatrixCursor cursor = new MatrixCursor(new String[]{"_display_name", "_size", "mime_type"});
        cursor.addRow(new Object[]{f.getName(), f.length(), getType(uri)});
        return cursor;
    }

    @Override
    public String getType(Uri uri) {
        File f = fileFor(uri);
        return f == null ? "application/octet-stream" : mimeOf(f.getAbsolutePath());
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File f = fileFor(uri);
        if (f == null || !f.exists()) throw new FileNotFoundException("file not found or not allowed");
        return ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY);
    }
}

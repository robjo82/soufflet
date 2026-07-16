package fr.robinjoseph.soufflet;

import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class SouffletUnitTest {
    @Test
    public void releaseApkNameUsesSemanticVersion() {
        assertTrue("soufflet-android-v1.6.0.apk".matches("^soufflet-android-v?[0-9]+\\.[0-9]+\\.[0-9]+\\.apk$"));
    }
}

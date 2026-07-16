package fr.robinjoseph.soufflet;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SouffletDistribution")
public class SouffletDistributionPlugin extends Plugin {
    @PluginMethod
    public void getChannel(PluginCall call) {
        JSObject result = new JSObject();
        result.put("channel", BuildConfig.FLAVOR);
        call.resolve(result);
    }
}

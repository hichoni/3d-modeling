// Signs the CI-built unsigned APK with APK Signature Scheme v2 (minSdk 29, so no v1 JAR signature) and verifies it.
// Run through sign-apk.cjs, which supplies apksig on the classpath and the private key from runtime/.
import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;
import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.List;

public class SignApk {
    public static void main(String[] a) throws Exception {
        if (a.length != 3 || System.getenv("CLICK_APK_PASS") == null) throw new IllegalArgumentException("usage: CLICK_APK_PASS=... SignApk <unsigned.apk> <signed.apk> <keystore.p12>");
        char[] pass = System.getenv("CLICK_APK_PASS").toCharArray();
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (FileInputStream in = new FileInputStream(a[2])) { ks.load(in, pass); }
        String alias = ks.aliases().nextElement();
        PrivateKey key = (PrivateKey) ks.getKey(alias, pass);
        X509Certificate cert = (X509Certificate) ks.getCertificate(alias);
        ApkSigner.SignerConfig signer = new ApkSigner.SignerConfig.Builder("click", key, List.of(cert)).build();
        new ApkSigner.Builder(List.of(signer)).setInputApk(new File(a[0])).setOutputApk(new File(a[1]))
                .setMinSdkVersion(29).setV1SigningEnabled(false).setV2SigningEnabled(true).build().sign();
        ApkVerifier.Result r = new ApkVerifier.Builder(new File(a[1])).setMinCheckedPlatformVersion(29).build().verify();
        if (!r.isVerified() || !r.isVerifiedUsingV2Scheme()) { System.err.println("verification failed: " + r.getErrors()); System.exit(1); }
        System.out.println("signed and verified (v2): " + a[1]);
    }
}

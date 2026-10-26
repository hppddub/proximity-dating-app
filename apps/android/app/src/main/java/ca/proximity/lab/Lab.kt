package ca.proximity.lab

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI
import java.security.KeyStore
import java.security.SecureRandom
import java.util.concurrent.Executors
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.Mac
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

object Lab {
    lateinit var context: Context
    val io = Executors.newSingleThreadExecutor()
    private val lock = Any()
    private val events = ArrayDeque<String>()
    @Volatile var session: JSONObject? = null
    @Volatile var offer: JSONObject? = null
    @Volatile var clockOffset: Long = 0
    var credentials: JSONObject
        get() = synchronized(lock) { readSecret() }
        set(value) = synchronized(lock) {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key())
            val bytes = cipher.iv + cipher.doFinal(value.toString().toByteArray())
            context.getSharedPreferences("lab", 0).edit().putString("credentials", Base64.encodeToString(bytes, Base64.NO_WRAP)).commit()
        }
    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        return (ks.getKey("lab", null) as? SecretKey) ?: KeyGenerator.getInstance("AES", "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder("lab", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    private fun readSecret(): JSONObject {
        val saved = context.getSharedPreferences("lab", 0).getString("credentials", null) ?: return JSONObject()
        val bytes = Base64.decode(saved, Base64.NO_WRAP)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0,12)))
        return JSONObject(String(cipher.doFinal(bytes.copyOfRange(12,bytes.size))))
    }
    fun now() = System.currentTimeMillis() + clockOffset
    fun nonce(): String = ByteArray(16).apply { SecureRandom().nextBytes(this) }.joinToString("") { "%02x".format(it) }
    fun sign(text: String): String {
        val hex = credentials.getString("proofKey")
        val key = hex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
        val mac = Mac.getInstance("HmacSHA256"); mac.init(SecretKeySpec(key,"HmacSHA256"))
        return mac.doFinal(text.toByteArray()).joinToString("") { "%02x".format(it) }
    }
    fun hello(): JSONObject {
        val s = session ?: error("Start a session first")
        val aliases = s.getJSONArray("aliases"); val now = now()
        for (i in 0 until aliases.length()) {
            val a = aliases.getJSONObject(i)
            if (now >= a.getLong("from") && now < a.getLong("until")) return JSONObject().put("alias",a.getString("alias")).put("nonce",nonce()).put("at",now)
        }
        error("Session expired")
    }
    fun transcript(a: JSONObject,b: JSONObject) = "v1|${a.getString("alias")}|${b.getString("alias")}|${a.getString("nonce")}|${b.getString("nonce")}|${a.getLong("at")}|${b.getLong("at")}"
    fun request(path: String, body: JSONObject? = null, authenticated: Boolean = true): JSONObject {
        val c = credentials; val base = c.optString("url").trimEnd('/')
        require(base.isNotEmpty()) { "Enter coordinator URL" }
        val uri = URI(base + path)
        require(uri.scheme == "https" || (uri.scheme == "http" && uri.host in listOf("localhost","127.0.0.1","10.0.2.2"))) { "Use HTTPS (or adb reverse localhost for development)" }
        val conn = uri.toURL().openConnection() as HttpURLConnection
        conn.connectTimeout=8000; conn.readTimeout=8000; conn.instanceFollowRedirects=false
        conn.setRequestProperty("Content-Type","application/json")
        if(authenticated) conn.setRequestProperty("Authorization","Bearer ${c.getString("token")}")
        try {
            if(body!=null) { conn.requestMethod="POST"; conn.doOutput=true; conn.outputStream.use { it.write(body.toString().toByteArray()) } }
            val status=conn.responseCode
            val result = JSONObject((if(status in 200..299) conn.inputStream else conn.errorStream).bufferedReader().use{it.readText()})
            if(status !in 200..299) error(result.optString("error","HTTP $status"))
            return result
        } finally { conn.disconnect() }
    }
    fun refresh() {
        val result=request("/v1/state"); clockOffset=result.getLong("now")-System.currentTimeMillis()
        session=result.optJSONObject("session"); offer=result.optJSONObject("offer")
    }
    fun submit(proof: JSONObject) { io.execute { try { val r=request("/v1/encounters",proof); log("proof_accepted",r.optString("status")); refresh() } catch(e:Exception) { log("proof_failed",e.message?:"error") } } }
    fun log(event: String, detail: String = "") = synchronized(lock) {
        val record=JSONObject().put("v",1).put("at",System.currentTimeMillis()).put("event",event).put("detail",detail.take(160)).toString()
        events.addLast(record); while(events.size>2000) events.removeFirst()
    }
    fun export() = synchronized(lock) { events.joinToString("\n") }
}

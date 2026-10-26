package ca.proximity.lab

import android.Manifest
import android.app.Activity
import android.content.*
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.os.*
import android.util.Base64
import android.widget.*
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject

class MainActivity: Activity() {
    private lateinit var url:EditText
    private lateinit var invite:EditText
    private lateinit var status:TextView
    private lateinit var logs:TextView
    private lateinit var profile:TextView
    private lateinit var qr:ImageView
    private lateinit var challenge:EditText
    private val handler=Handler(Looper.getMainLooper())
    private var lastRefresh=0L
    private var refreshing=false
    private val update=object:Runnable { override fun run() {
        status.text="Session: ${Lab.session?.optString("id")?:"paused"}\nOffer: ${Lab.offer?.optString("state")?:"none"}\n${Lab.offer?.optString("cue")?:""}"
        logs.text=Lab.export().lines().takeLast(12).joinToString("\n")
        if(!refreshing && Lab.credentials.has("token") && System.currentTimeMillis()-lastRefresh>5000) {
            lastRefresh=System.currentTimeMillis(); refreshing=true
            Lab.io.execute { try { Lab.refresh() } catch(_:Exception) {} finally {refreshing=false} }
        }
        handler.postDelayed(this,1000)
    } }
    override fun onCreate(savedInstanceState:Bundle?) {
        super.onCreate(savedInstanceState); Lab.context=applicationContext
        val scroll=ScrollView(this); val column=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(24,24,24,24)};scroll.addView(column);setContentView(scroll)
        fun label(s:String)=TextView(this).also{it.text=s;column.addView(it)}
        fun input(h:String)=EditText(this).also{it.hint=h;it.setSingleLine();column.addView(it)}
        fun button(s:String,action:()->Unit) { column.addView(Button(this).apply{text=s;setOnClickListener{action()}}) }
        label("Proximity Lab — experimental BLE diagnostic. No real profiles. Android foreground-service + polling variant; not a background guarantee.")
        url=input("Coordinator HTTPS URL (or http://localhost:8787 with adb reverse)"); url.setText(Lab.credentials.optString("url","http://localhost:8787"))
        invite=input("Single-use enrollment invite")
        button("Grant Bluetooth / notification permissions") { requestPermissions(arrayOf(Manifest.permission.BLUETOOTH_SCAN,Manifest.permission.BLUETOOTH_ADVERTISE,Manifest.permission.BLUETOOTH_CONNECT).let{if(Build.VERSION.SDK_INT>=33) it+Manifest.permission.POST_NOTIFICATIONS else it},1) }
        button("Enroll this installation") { perform {
            Lab.credentials=JSONObject().put("url",url.text.toString())
            val r=Lab.request("/v1/enroll",JSONObject().put("invite",invite.text.toString()).put("platform","android"),false)
            Lab.credentials=r.put("url",url.text.toString()); configurePush(); Lab.log("enrolled")
        } }
        button("Start 30-minute session + discovery") { perform {
            require(checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN)==PackageManager.PERMISSION_GRANTED){"Grant Bluetooth permissions first"}
            val r=Lab.request("/v1/session",JSONObject()); Lab.session=r.getJSONObject("session"); Lab.clockOffset=r.getLong("now")-System.currentTimeMillis()
            runOnUiThread{startForegroundService(Intent(this,DiscoveryService::class.java))}
        } }
        button("Pause and cancel current offer") {
            stopService(Intent(this,DiscoveryService::class.java))
            Lab.session=null; Lab.offer=null; profile.text=""; qr.setImageDrawable(null)
            perform{Lab.request("/v1/pause",JSONObject());Lab.refresh()}
        }
        button("Refresh server state") { perform{Lab.refresh(); val o=Lab.offer; if(o?.optString("state")=="connected") {
            val p=Lab.request("/v1/offers/${o.getString("id")}/profile")
            runOnUiThread{profile.text=p.getJSONObject("profile").toString(2)}
        } } }
        status=label("")
        button("I'm open to saying hello") { action("ready") }
        button("Not now") { profile.text=""; qr.setImageDrawable(null);action("decline") }
        qr=ImageView(this);column.addView(qr,LinearLayout.LayoutParams(400,400))
        challenge=input("Scanned connection challenge (manual fallback)")
        button("Show connection QR") { perform {
            val id=Lab.offer?.getString("id")?:error("No offer")
            val r=Lab.request("/v1/offers/$id/qr",JSONObject())
            val bytes=Base64.decode(r.getString("png").substringAfter(","),Base64.DEFAULT)
            runOnUiThread{qr.setImageBitmap(BitmapFactory.decodeByteArray(bytes,0,bytes.size));challenge.setText(r.getString("challenge"))}
        } }
        button("Scan connection QR") {
            GmsBarcodeScanning.getClient(this).startScan().addOnSuccessListener{b->challenge.setText(b.rawValue?:"")}.addOnFailureListener{e->Lab.log("scan_error",e.message?:"error")}
        }
        button("Use scanned challenge") { perform {
            val id=Lab.offer?.getString("id")?:error("No offer")
            Lab.request("/v1/offers/$id/scan",JSONObject().put("challenge",challenge.text.toString()));Lab.refresh()
        } }
        button("Connect and share synthetic profiles") { action("confirm") }
        profile=label("")
        button("Disconnect") { profile.text="";qr.setImageDrawable(null);action("disconnect") }
        button("Block this test pair") { profile.text="";qr.setImageDrawable(null);action("block") }
        button("Export diagnostics") { val i=Intent(Intent.ACTION_CREATE_DOCUMENT).apply{type="application/x-ndjson";putExtra(Intent.EXTRA_TITLE,"proximity-diagnostics.jsonl")};startActivityForResult(i,77) }
        logs=label("")
    }
    private fun perform(block:()->Unit) { Lab.io.execute{try{block()}catch(e:Exception){Lab.log("action_failed",e.message?:"error")}} }
    private fun action(action:String) { perform { val id=Lab.offer?.getString("id")?:error("No current offer");Lab.request("/v1/offers/$id/$action",JSONObject());Lab.refresh() } }
    private fun configurePush() {
        val config=Lab.request("/v1/client-config").optJSONObject("firebase")?:return
        if(FirebaseApp.getApps(this).isEmpty()) FirebaseApp.initializeApp(this,FirebaseOptions.Builder()
            .setApplicationId(config.getString("applicationId")).setApiKey(config.getString("apiKey"))
            .setProjectId(config.getString("projectId")).setGcmSenderId(config.getString("senderId")).build())
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token -> perform { Lab.request("/v1/push",JSONObject().put("platform","android").put("token",token));Lab.log("push_registered") } }
    }
    override fun onResume(){super.onResume();handler.post(update)}
    override fun onPause(){handler.removeCallbacks(update);super.onPause()}
    @Deprecated("Activity result used for document export")
    override fun onActivityResult(requestCode:Int,resultCode:Int,data:Intent?) {
        super.onActivityResult(requestCode,resultCode,data)
        if(requestCode==77 && resultCode==RESULT_OK) data?.data?.let{uri->contentResolver.openOutputStream(uri)?.use{it.write(Lab.export().toByteArray())}}
    }
}

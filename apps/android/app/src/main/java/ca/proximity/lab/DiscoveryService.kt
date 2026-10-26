@file:Suppress("MissingPermission", "DEPRECATION")
package ca.proximity.lab

import android.app.*
import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Intent
import android.os.*
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.UUID

class DiscoveryService : Service() {
    private val serviceId=UUID.fromString("7b9e1000-29c4-4a91-8c65-66d9384a1000")
    private val helloId=UUID.fromString("7b9e1001-29c4-4a91-8c65-66d9384a1000")
    private val replyId=UUID.fromString("7b9e1002-29c4-4a91-8c65-66d9384a1000")
    private val finishId=UUID.fromString("7b9e1003-29c4-4a91-8c65-66d9384a1000")
    private lateinit var adapter: BluetoothAdapter
    private var server: BluetoothGattServer?=null
    private var client: BluetoothGatt?=null
    private val handler=Handler(Looper.getMainLooper())
    private val frames=mutableMapOf<String,ByteArrayOutputStream>()
    private val seqs=mutableMapOf<String,Int>()
    private val frameStarted=mutableMapOf<String,Long>()
    private val replies=mutableMapOf<String,JSONObject>()
    private val hellos=mutableMapOf<String,JSONObject>()
    private val cooldown=mutableMapOf<String,Long>()
    private var localA:JSONObject?=null
    private var finalProof:JSONObject?=null
    private var writeQueue=ArrayDeque<ByteArray>()
    private var writing: UUID?=null
    private var lastOffer:String?=null
    private var running=false
    private var role="both"
    private var lastPoll=0L
    private var polling=false
    private var diagnosticPolling=true
    private val tick=object:Runnable { override fun run() {
        if ((Lab.session?.optLong("until")?:0) <= Lab.now()) { Lab.log("session_expired"); stopSelf(); return }
        if(diagnosticPolling && !polling && System.currentTimeMillis()-lastPoll>10000) { polling=true; lastPoll=System.currentTimeMillis(); Lab.io.execute {
            try { Lab.refresh(); val o=Lab.offer
                if(o!=null && o.getString("id")!=lastOffer) { lastOffer=o.getString("id"); notifyOffer(o) }
            } catch(e:Exception) { Lab.log("refresh_failed",e.message?:"error") } finally { polling=false }
        } }
        handler.postDelayed(this,2000)
    } }
    override fun onBind(intent:Intent?)=null
    override fun onCreate() { super.onCreate(); Lab.context=applicationContext }
    override fun onStartCommand(intent:Intent?, flags:Int, startId:Int):Int {
        if(intent?.action=="STOP") { stopSelf(); return START_NOT_STICKY }
        if(running) return START_NOT_STICKY
        running=true;role=intent?.getStringExtra("role")?:"both";diagnosticPolling=intent?.getBooleanExtra("diagnosticPolling",true)?:true
        try {
            val nm=getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(NotificationChannel("discovery","Discovery experiment",NotificationManager.IMPORTANCE_LOW))
            nm.createNotificationChannel(NotificationChannel("offers","Test introductions",NotificationManager.IMPORTANCE_DEFAULT))
            val pi=PendingIntent.getActivity(this,0,Intent(this,MainActivity::class.java),PendingIntent.FLAG_IMMUTABLE)
            val stop=PendingIntent.getService(this,1,Intent(this,DiscoveryService::class.java).setAction("STOP"),PendingIntent.FLAG_IMMUTABLE)
            startForeground(1,Notification.Builder(this,"discovery").setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
                .setContentTitle("Proximity Lab: discovery active").setContentText("Foreground-service test variant; tap to inspect").setContentIntent(pi).addAction(Notification.Action.Builder(null,"Stop",stop).build()).build())
            val manager=getSystemService(BluetoothManager::class.java); adapter=manager.adapter
            require(adapter.isEnabled) { "Enable Bluetooth" }
            if(role!="central") server=manager.openGattServer(this,serverCallbacks)
            val svc=BluetoothGattService(serviceId,BluetoothGattService.SERVICE_TYPE_PRIMARY)
            svc.addCharacteristic(BluetoothGattCharacteristic(helloId,BluetoothGattCharacteristic.PROPERTY_WRITE,BluetoothGattCharacteristic.PERMISSION_WRITE))
            svc.addCharacteristic(BluetoothGattCharacteristic(replyId,BluetoothGattCharacteristic.PROPERTY_READ,BluetoothGattCharacteristic.PERMISSION_READ))
            svc.addCharacteristic(BluetoothGattCharacteristic(finishId,BluetoothGattCharacteristic.PROPERTY_WRITE,BluetoothGattCharacteristic.PERMISSION_WRITE))
            server?.addService(svc)
            if(role!="peripheral") adapter.bluetoothLeScanner.startScan(listOf(ScanFilter.Builder().setServiceUuid(ParcelUuid(serviceId)).build()),ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_POWER).build(),scanner)
            Lab.log("discovery_started","foreground-service; LOW_POWER; role=$role")
            handler.post(tick)
        } catch(e:Exception) { Lab.log("discovery_error",e.message?:"error"); stopSelf() }
        return START_NOT_STICKY
    }
    private fun notifyOffer(o:JSONObject) {
        val pi=PendingIntent.getActivity(this,0,Intent(this,MainActivity::class.java),PendingIntent.FLAG_IMMUTABLE)
        getSystemService(NotificationManager::class.java).notify(2,Notification.Builder(this,"offers").setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("An introduction may be available").setContentText("Open to check. Diagnostic polling delivery.").setContentIntent(pi).setAutoCancel(true).setTimeoutAfter(120000).build())
        Lab.log("local_offer_notification_requested","polling transport; not FCM delivery")
    }
    private val advertiser=object:AdvertiseCallback() {
        override fun onStartSuccess(settings:AdvertiseSettings) { Lab.log("advertising_started") }
        override fun onStartFailure(errorCode:Int) { Lab.log("advertising_failed",errorCode.toString()) }
    }
    private val scanner=object:ScanCallback() {
        override fun onScanFailed(errorCode:Int) { Lab.log("scan_failed",errorCode.toString()) }
        override fun onScanResult(type:Int,result:ScanResult) { handler.post {
            if(client!=null) return@post
            val key=result.device.address; val now=System.currentTimeMillis()
            if(now-(cooldown[key]?:0)<10000) return@post
            cooldown[key]=now; if(cooldown.size>100) cooldown.keys.firstOrNull()?.let{cooldown.remove(it)}
            Lab.log("peer_discovered","rssi=${result.rssi}")
            client=result.device.connectGatt(this@DiscoveryService,false,clientCallbacks,BluetoothDevice.TRANSPORT_LE)
            val active=client
            handler.postDelayed({ if(client===active) closeClient() },20000)
        } }
    }
    private val serverCallbacks=object:BluetoothGattServerCallback() {
        override fun onServiceAdded(status:Int,service:BluetoothGattService) {
            if(status==BluetoothGatt.GATT_SUCCESS) adapter.bluetoothLeAdvertiser?.startAdvertising(
                AdvertiseSettings.Builder().setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_POWER).setConnectable(true).build(),
                AdvertiseData.Builder().addServiceUuid(ParcelUuid(serviceId)).build(),advertiser)
            else Lab.log("service_failed",status.toString())
        }
        override fun onConnectionStateChange(device:BluetoothDevice,status:Int,newState:Int) {
            if(newState==BluetoothProfile.STATE_DISCONNECTED) synchronized(frames) { val k=device.address; frames.remove(k); seqs.remove(k); frameStarted.remove(k); hellos.remove(k); replies.remove(k) }
        }
        override fun onCharacteristicWriteRequest(device:BluetoothDevice,requestId:Int,c:BluetoothGattCharacteristic,preparedWrite:Boolean,responseNeeded:Boolean,offset:Int,value:ByteArray) {
            var status=BluetoothGatt.GATT_SUCCESS
            try { synchronized(frames) {
                require(!preparedWrite && offset==0 && value.size>=2)
                val k=device.address; val seq=value[0].toInt() and 255
                if(seq==0) { require(frames.size<8 || frames.containsKey(k)); frames[k]=ByteArrayOutputStream(); seqs[k]=0; frameStarted[k]=System.currentTimeMillis() }
                require(System.currentTimeMillis()-(frameStarted[k]?:0)<30000)
                require(seqs[k]==seq); val out=frames[k]?:error("Missing frame")
                out.write(value,2,value.size-2); require(out.size()<=4096); seqs[k]=seq+1
                if(value[1].toInt()==1) {
                    val message=JSONObject(out.toString("UTF-8")); frames.remove(k); seqs.remove(k); frameStarted.remove(k)
                    if(c.uuid==helloId) {
                        require(message.getString("nonce").length==32); val b=Lab.hello(); b.put("sig",Lab.sign(Lab.transcript(message,b)))
                        hellos[k]=message; replies[k]=b; Lab.log("hello_received")
                    } else if(c.uuid==finishId) {
                        require(Lab.transcript(message.getJSONObject("a"),message.getJSONObject("b"))==Lab.transcript(hellos[k]?:error("No hello"),replies[k]?:error("No reply")))
                        require(message.getJSONObject("b").getString("sig")==replies[k]?.getString("sig"))
                        Lab.log("exchange_complete","peripheral"); Lab.submit(message)
                    } else error("Unknown characteristic")
                }
            } } catch(e:Exception) { status=BluetoothGatt.GATT_FAILURE; Lab.log("write_rejected",e.message?:"error") }
            if(responseNeeded) server?.sendResponse(device,requestId,status,offset,null)
        }
        override fun onCharacteristicReadRequest(device:BluetoothDevice,requestId:Int,offset:Int,c:BluetoothGattCharacteristic) {
            val bytes=synchronized(frames){replies[device.address]?.toString()?.toByteArray()}
            if(c.uuid!=replyId || bytes==null || offset>bytes.size) server?.sendResponse(device,requestId,BluetoothGatt.GATT_INVALID_OFFSET,offset,null)
            else server?.sendResponse(device,requestId,BluetoothGatt.GATT_SUCCESS,offset,bytes.copyOfRange(offset,bytes.size))
        }
    }
    private fun send(g:BluetoothGatt,id:UUID,message:JSONObject) {
        writing=id; writeQueue.clear(); val bytes=message.toString().toByteArray()
        bytes.toList().chunked(18).forEachIndexed { i, part -> writeQueue.addLast(byteArrayOf(i.toByte(),if((i+1)*18>=bytes.size) 1 else 0)+part.toByteArray()) }
        writeNext(g)
    }
    private fun writeNext(g:BluetoothGatt) {
        val c=g.getService(serviceId)?.getCharacteristic(writing)?:return closeClient()
        val part=writeQueue.removeFirstOrNull()?:return
        c.writeType=BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT; c.value=part
        if(!g.writeCharacteristic(c)) { Lab.log("write_start_failed"); closeClient() }
    }
    private val clientCallbacks=object:BluetoothGattCallback() {
        override fun onConnectionStateChange(g:BluetoothGatt,status:Int,newState:Int) {
            if(status!=BluetoothGatt.GATT_SUCCESS || newState==BluetoothProfile.STATE_DISCONNECTED) { handler.post { if(client===g) closeClient() else g.close() }; return }
            if(newState==BluetoothProfile.STATE_CONNECTED) { Lab.log("gatt_connected"); g.discoverServices() }
        }
        override fun onServicesDiscovered(g:BluetoothGatt,status:Int) {
            try { require(status==BluetoothGatt.GATT_SUCCESS); localA=Lab.hello(); send(g,helloId,localA!!) }
            catch(e:Exception) { Lab.log("exchange_failed",e.message?:"error"); closeClient() }
        }
        override fun onCharacteristicWrite(g:BluetoothGatt,c:BluetoothGattCharacteristic,status:Int) {
            if(status!=BluetoothGatt.GATT_SUCCESS) { Lab.log("write_failed",status.toString()); closeClient(); return }
            if(writeQueue.isNotEmpty()) { writeNext(g); return }
            if(writing==helloId) { g.readCharacteristic(g.getService(serviceId).getCharacteristic(replyId)) }
            else { finalProof?.let{Lab.submit(it)}; Lab.log("exchange_complete","central"); closeClient() }
        }
        override fun onCharacteristicRead(g:BluetoothGatt,c:BluetoothGattCharacteristic,value:ByteArray,status:Int) {
            try {
                require(status==BluetoothGatt.GATT_SUCCESS)
                val b=JSONObject(String(value)); val a=localA?:error("No hello")
                finalProof=JSONObject().put("a",a).put("b",b).put("sigA",Lab.sign(Lab.transcript(a,b)))
                send(g,finishId,finalProof!!)
            } catch(e:Exception) { Lab.log("reply_failed",e.message?:"error"); closeClient() }
        }
    }
    private fun closeClient() { client?.disconnect(); client?.close(); client=null; writeQueue.clear(); localA=null; finalProof=null }
    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        try { if(::adapter.isInitialized) { adapter.bluetoothLeScanner?.stopScan(scanner); adapter.bluetoothLeAdvertiser?.stopAdvertising(advertiser) }; closeClient(); server?.close() } catch(_:Exception) {}
        server=null; Lab.locallyPaused=true;Lab.session=null;Lab.offer=null
        if(Lab.credentials.has("token"))Lab.io.execute{try{Lab.request("/v1/pause",JSONObject())}catch(_:Exception){Lab.log("pause_pending","Server unreachable; session/offer expiry still apply")}}
        Lab.log("discovery_stopped"); stopForeground(STOP_FOREGROUND_REMOVE); super.onDestroy()
    }
}

package ca.proximity.lab

import android.app.*
import android.content.Intent
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import org.json.JSONObject

class PushService:FirebaseMessagingService() {
    override fun onNewToken(token:String) {
        Lab.context=applicationContext
        if(Lab.credentials.has("token")) Lab.io.execute { try { Lab.request("/v1/push",JSONObject().put("platform","android").put("token",token)) }catch(_:Exception){} }
    }
    override fun onMessageReceived(message:RemoteMessage) {
        Lab.context=applicationContext
        val expiry=message.data["expiresAt"]?.toLongOrNull()?:return
        if(expiry<=System.currentTimeMillis())return
        val nm=getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel("offers","Test introductions",NotificationManager.IMPORTANCE_DEFAULT))
        val pi=PendingIntent.getActivity(this,0,Intent(this,MainActivity::class.java),PendingIntent.FLAG_IMMUTABLE)
        nm.notify(3,Notification.Builder(this,"offers").setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("An introduction may be available").setContentText("Open to check.").setContentIntent(pi).setAutoCancel(true)
            .setTimeoutAfter(expiry-System.currentTimeMillis()).build())
        Lab.log("fcm_notification_requested")
    }
}

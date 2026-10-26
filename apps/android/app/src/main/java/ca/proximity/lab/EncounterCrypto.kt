package ca.proximity.lab

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

object EncounterCrypto {
    fun transcript(aliasA:String,aliasB:String,nonceA:String,nonceB:String,atA:Long,atB:Long) = "v1|$aliasA|$aliasB|$nonceA|$nonceB|$atA|$atB"
    fun sign(hexKey:String,text:String):String {
        require(hexKey.matches(Regex("[0-9a-f]{64}"))) { "Invalid proof key" }
        val key=hexKey.chunked(2).map{it.toInt(16).toByte()}.toByteArray()
        val mac=Mac.getInstance("HmacSHA256");mac.init(SecretKeySpec(key,"HmacSHA256"))
        return mac.doFinal(text.toByteArray(Charsets.UTF_8)).joinToString(""){"%02x".format(it)}
    }
}

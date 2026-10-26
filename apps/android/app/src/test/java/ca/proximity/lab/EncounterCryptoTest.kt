package ca.proximity.lab
import org.junit.Assert.*
import org.junit.Test
class EncounterCryptoTest {
    @Test fun interoperatesWithNodeAndSwift() {
        val text=EncounterCrypto.transcript("a".repeat(32),"b".repeat(32),"c".repeat(32),"d".repeat(32),1793000000000L,1793000000123L)
        assertEquals("v1|aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|cccccccccccccccccccccccccccccccc|dddddddddddddddddddddddddddddddd|1793000000000|1793000000123",text)
        assertEquals("a6c3316113a69bb62055c47f97cc4c19aa99a4107bce674892e0cc60352dbccd",EncounterCrypto.sign("01".repeat(32),text))
    }
    @Test fun rejectsMalformedKeys() { try{EncounterCrypto.sign("not-hex","test");fail("Expected rejection")}catch(_:IllegalArgumentException){} }
}

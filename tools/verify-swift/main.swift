import Foundation
let text=EncounterProtocol.transcript(aliasA:String(repeating:"a",count:32),aliasB:String(repeating:"b",count:32),nonceA:String(repeating:"c",count:32),nonceB:String(repeating:"d",count:32),atA:1793000000000,atB:1793000000123)
precondition(text=="v1|aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa|bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb|cccccccccccccccccccccccccccccccc|dddddddddddddddddddddddddddddddd|1793000000000|1793000000123")
let actual=try EncounterProtocol.sign(hexKey:String(repeating:"01",count:32),text:text)
precondition(actual=="a6c3316113a69bb62055c47f97cc4c19aa99a4107bce674892e0cc60352dbccd")
print("Swift protocol matches Node/Android golden HMAC vector")

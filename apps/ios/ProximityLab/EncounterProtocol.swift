import Foundation
import CryptoKit

enum EncounterProtocol {
    static func transcript(aliasA:String,aliasB:String,nonceA:String,nonceB:String,atA:Int64,atB:Int64)->String {
        "v1|\(aliasA)|\(aliasB)|\(nonceA)|\(nonceB)|\(atA)|\(atB)"
    }
    static func sign(hexKey:String,text:String)throws->String {
        guard hexKey.count==64 else{throw NSError(domain:"Protocol",code:1)}
        var bytes=[UInt8]()
        for i in stride(from:0,to:hexKey.count,by:2) {
            let start=hexKey.index(hexKey.startIndex,offsetBy:i)
            guard let byte=UInt8(hexKey[start..<hexKey.index(start,offsetBy:2)],radix:16) else{throw NSError(domain:"Protocol",code:2)}
            bytes.append(byte)
        }
        return HMAC<SHA256>.authenticationCode(for:Data(text.utf8),using:SymmetricKey(data:Data(bytes))).map{String(format:"%02x",$0)}.joined()
    }
}

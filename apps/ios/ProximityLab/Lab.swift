import Foundation
import CryptoKit
import Security
import Combine
import UserNotifications

final class Lab: ObservableObject {
    static let shared = Lab()
    @Published var credentials: [String: String] = [:]
    @Published var session: [String: Any]?
    @Published var offer: [String: Any]?
    @Published var events = [String]()
    @Published var message = "Ready. Enroll, then start a session."
    var clockOffset: Double = 0
    init() {
        var query: [String:Any] = [kSecClass as String:kSecClassGenericPassword, kSecAttrService as String:"ca.proximity.lab",kSecAttrAccount as String:"installation",kSecReturnData as String:true]
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item:CFTypeRef?
        if SecItemCopyMatching(query as CFDictionary,&item) == errSecSuccess, let data=item as? Data,
           let value=try? JSONSerialization.jsonObject(with:data) as? [String:String] { credentials=value }
    }
    func saveCredentials(_ value:[String:String]) throws {
        let query:[String:Any]=[kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:"ca.proximity.lab",kSecAttrAccount as String:"installation"]
        SecItemDelete(query as CFDictionary)
        var entry=query; entry[kSecValueData as String]=try JSONSerialization.data(withJSONObject:value)
        entry[kSecAttrAccessible as String]=kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        guard SecItemAdd(entry as CFDictionary,nil)==errSecSuccess else { throw failure("Keychain write failed") }
        credentials=value
    }
    func now()->Int64 { Int64(Date().timeIntervalSince1970*1000+clockOffset) }
    func failure(_ text:String)->NSError { NSError(domain:"ProximityLab",code:1,userInfo:[NSLocalizedDescriptionKey:text]) }
    func nonce() -> String {
        var bytes=[UInt8](repeating:0,count:16); let result=SecRandomCopyBytes(kSecRandomDefault,bytes.count,&bytes)
        precondition(result==errSecSuccess); return bytes.map{String(format:"%02x",$0)}.joined()
    }
    func hello() throws -> [String:Any] {
        guard let aliases=session?["aliases"] as? [[String:Any]],
              let alias=aliases.first(where:{ (($0["from"] as? NSNumber)?.int64Value ?? Int64.max) <= now() && now() < (($0["until"] as? NSNumber)?.int64Value ?? 0) })?["alias"] as? String else { throw failure("No current session alias") }
        return ["alias":alias,"nonce":nonce(),"at":now()]
    }
    func transcript(_ a:[String:Any],_ b:[String:Any]) throws -> String {
        guard let aa=a["alias"] as? String,let ba=b["alias"] as? String,let an=a["nonce"] as? String,let bn=b["nonce"] as? String,
              let at=a["at"] as? NSNumber,let bt=b["at"] as? NSNumber else {throw failure("Invalid peer payload")}
        return "v1|\(aa)|\(ba)|\(an)|\(bn)|\(at.int64Value)|\(bt.int64Value)"
    }
    func sign(_ text:String)throws->String {
        guard let hex=credentials["proofKey"],hex.count==64 else {throw failure("Enroll first")}
        let bytes=stride(from:0,to:hex.count,by:2).map{i->UInt8 in let start=hex.index(hex.startIndex,offsetBy:i);return UInt8(hex[start..<hex.index(start,offsetBy:2)],radix:16)!}
        return HMAC<SHA256>.authenticationCode(for:Data(text.utf8),using:SymmetricKey(data:Data(bytes))).map{String(format:"%02x",$0)}.joined()
    }
    func request(_ path:String,_ body:[String:Any]?=nil,auth:Bool=true) async throws->[String:Any] {
        guard let base=credentials["url"], let url=URL(string:base.trimmingCharacters(in:CharacterSet(charactersIn:"/"))+path),
              url.scheme=="https" || (url.scheme=="http" && ["localhost","127.0.0.1"].contains(url.host ?? "")) else {throw failure("Use an HTTPS coordinator URL")}
        var request=URLRequest(url:url);request.timeoutInterval=10
        request.setValue("application/json",forHTTPHeaderField:"Content-Type")
        if auth {request.setValue("Bearer \(credentials["token"] ?? "")",forHTTPHeaderField:"Authorization")}
        if let body=body {request.httpMethod="POST";request.httpBody=try JSONSerialization.data(withJSONObject:body)}
        let (data,response)=try await URLSession.shared.data(for:request)
        guard let result=try JSONSerialization.jsonObject(with:data) as? [String:Any] else {throw failure("Invalid coordinator reply")}
        guard let http=response as? HTTPURLResponse,(200..<300).contains(http.statusCode) else {throw failure(result["error"] as? String ?? "Request failed")}
        return result
    }
    @MainActor func refresh() async throws {
        let r=try await request("/v1/state");session=r["session"] as? [String:Any];offer=r["offer"] as? [String:Any]
        if let n=r["now"] as? Double {clockOffset=n-Date().timeIntervalSince1970*1000}
    }
    func log(_ event:String,_ detail:String="") {
        let record:[String:Any] = ["v":1,"at":Int64(Date().timeIntervalSince1970*1000),"event":event,"detail":String(detail.prefix(160))]
        if let data=try? JSONSerialization.data(withJSONObject:record,options:.sortedKeys),let line=String(data:data,encoding:.utf8) {
            DispatchQueue.main.async { self.events.append(line);if self.events.count>2000 {self.events.removeFirst()};self.message=event }
        }
    }
    func submit(_ proof:[String:Any]) {
        Task { @MainActor in
            do {let r=try await request("/v1/encounters",proof);log("proof_accepted",r["status"] as? String ?? "");try await refresh()}
            catch {log("proof_failed",error.localizedDescription)}
        }
    }
    @MainActor func registerPush(_ token:String) async {
        guard credentials["token"] != nil else { return }
        do {_ = try await request("/v1/push",["platform":"ios","token":token]);log("apns_registered")}
        catch {log("apns_registration_failed",error.localizedDescription)}
    }
}

import Foundation
import CryptoKit
import Security
import Combine
import UserNotifications

private final class NoRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session:URLSession,task:URLSessionTask,willPerformHTTPRedirection response:HTTPURLResponse,newRequest request:URLRequest,completionHandler:@escaping (URLRequest?)->Void) {completionHandler(nil)}
}
final class Lab: ObservableObject {
    private static let transport:URLSession = {
        let config=URLSessionConfiguration.ephemeral;config.httpShouldSetCookies=false;config.httpCookieAcceptPolicy = .never
        return URLSession(configuration:config,delegate:NoRedirects(),delegateQueue:nil)
    }()
    static let shared = Lab()
    @Published var credentials: [String: String] = [:]
    @Published var session: [String: Any]?
    @Published var offer: [String: Any]?
    @Published var events = [String]()
    @Published var message = "Ready. Enroll, then start a session."
    var clockOffset: Double = 0
    var locallyPaused = true
    @Published var diagnosticAlerts=true
    var lastDiagnosticOffer:String?
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
        guard !locallyPaused, let aliases=session?["aliases"] as? [[String:Any]],
              let alias=aliases.first(where:{ (($0["from"] as? NSNumber)?.int64Value ?? Int64.max) <= now() && now() < (($0["until"] as? NSNumber)?.int64Value ?? 0) })?["alias"] as? String else { throw failure("No current session alias") }
        return ["alias":alias,"nonce":nonce(),"at":now()]
    }
    func transcript(_ a:[String:Any],_ b:[String:Any]) throws -> String {
        guard let aa=a["alias"] as? String,let ba=b["alias"] as? String,let an=a["nonce"] as? String,let bn=b["nonce"] as? String,
              let at=a["at"] as? NSNumber,let bt=b["at"] as? NSNumber else {throw failure("Invalid peer payload")}
        return EncounterProtocol.transcript(aliasA:aa,aliasB:ba,nonceA:an,nonceB:bn,atA:at.int64Value,atB:bt.int64Value)
    }
    func sign(_ text:String)throws->String {
        guard let hex=credentials["proofKey"],hex.count==64 else {throw failure("Enroll first")}
        return try EncounterProtocol.sign(hexKey:hex,text:text)
    }
    func request(_ path:String,_ body:[String:Any]?=nil,auth:Bool=true) async throws->[String:Any] {
        guard let base=credentials["url"], let url=URL(string:base.trimmingCharacters(in:CharacterSet(charactersIn:"/"))+path),
              url.scheme=="https" || (url.scheme=="http" && ["localhost","127.0.0.1"].contains(url.host ?? "")) else {throw failure("Use an HTTPS coordinator URL")}
        var request=URLRequest(url:url);request.timeoutInterval=10
        request.setValue("application/json",forHTTPHeaderField:"Content-Type")
        if auth {request.setValue("Bearer \(credentials["token"] ?? "")",forHTTPHeaderField:"Authorization")}
        if let body=body {request.httpMethod="POST";request.httpBody=try JSONSerialization.data(withJSONObject:body)}
        let (data,response)=try await Self.transport.data(for:request)
        guard let result=try JSONSerialization.jsonObject(with:data) as? [String:Any] else {throw failure("Invalid coordinator reply")}
        guard let http=response as? HTTPURLResponse,(200..<300).contains(http.statusCode) else {throw failure(result["error"] as? String ?? "Request failed")}
        return result
    }
    @MainActor func refresh() async throws {
        let r=try await request("/v1/state");session=locallyPaused ? nil : r["session"] as? [String:Any];offer=r["offer"] as? [String:Any]
        if locallyPaused && offer?["state"] as? String != "connected" {offer=nil}
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
            do {let r=try await request("/v1/encounters",proof);log("proof_accepted",r["status"] as? String ?? "");try await refresh();notifyDiagnosticOffer()}
            catch {log("proof_failed",error.localizedDescription)}
        }
    }
    @MainActor func notifyDiagnosticOffer() {
        guard diagnosticAlerts,let o=offer,let id=o["id"] as? String,id != lastDiagnosticOffer,
              ["offered","ready"].contains(o["state"] as? String ?? ""),let expiry=o["expiresAt"] as? NSNumber,expiry.int64Value>now() else{return}
        lastDiagnosticOffer=id
        let content=UNMutableNotificationContent();content.title="An introduction may be available";content.body="Diagnostic BLE-callback alert. Open to check.";content.sound = .default
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier:"diagnostic-introduction",content:content,trigger:nil)){error in
            self.log(error == nil ? "local_notification_requested":"local_notification_failed", "BLE callback variant; not APNs delivery")
        }
    }
    @MainActor func registerPush(_ token:String) async {
        guard credentials["token"] != nil else { return }
        do {_ = try await request("/v1/push",["platform":"ios","token":token]);log("apns_registered")}
        catch {log("apns_registration_failed",error.localizedDescription)}
    }
}

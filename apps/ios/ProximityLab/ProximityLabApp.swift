import SwiftUI
import UIKit
import UserNotifications
import AVFoundation
import CoreImage.CIFilterBuiltins

class AppDelegate:NSObject,UIApplicationDelegate,UNUserNotificationCenterDelegate {
    func application(_ application:UIApplication,didFinishLaunchingWithOptions options:[UIApplication.LaunchOptionsKey:Any]?=nil)->Bool {UNUserNotificationCenter.current().delegate=self;return true}
    func application(_ application:UIApplication,didRegisterForRemoteNotificationsWithDeviceToken deviceToken:Data) {
        let token=deviceToken.map{String(format:"%02x",$0)}.joined();Task{@MainActor in await Lab.shared.registerPush(token)}
    }
    func application(_ application:UIApplication,didFailToRegisterForRemoteNotificationsWithError error:Error) {Lab.shared.log("apns_unavailable",error.localizedDescription)}
    func userNotificationCenter(_ center:UNUserNotificationCenter,willPresent notification:UNNotification,withCompletionHandler completionHandler:@escaping (UNNotificationPresentationOptions)->Void) {completionHandler([.banner,.sound]);Lab.shared.log("apns_foreground_received")}
    func userNotificationCenter(_ center:UNUserNotificationCenter,didReceive response:UNNotificationResponse,withCompletionHandler completionHandler:@escaping ()->Void) {Task{@MainActor in try? await Lab.shared.refresh();completionHandler()}}
}
@main struct ProximityLabApp:App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    var body:some Scene {WindowGroup{LabView()}}
}
struct LabView:View {
    @ObservedObject var lab=Lab.shared
    @ObservedObject var bluetooth=BluetoothLab.shared
    @State var url=Lab.shared.credentials["url"] ?? "https://"
    @State var invite=""
    @State var challenge=""
    @State var qr:UIImage?
    @State var profile=""
    @State var scanning=false
    @Environment(\.scenePhase) var scenePhase
    func run(_ action:@escaping () async throws->Void) {Task{@MainActor in do{try await action()}catch{lab.message=error.localizedDescription;lab.log("action_failed",error.localizedDescription)}}}
    func action(_ name:String) {run {guard let id=lab.offer?["id"] as? String else{throw lab.failure("No current offer")};_ = try await lab.request("/v1/offers/\(id)/\(name)",[:]);try await lab.refresh()}}
    var body:some View {
        ScrollView {VStack(alignment:.leading,spacing:12) {
            Text("Proximity Lab — BLE experiment").font(.headline)
            Text("No real profiles. iOS background behavior is unverified. Use HTTPS; the simulator cannot validate proximity.")
            TextField("Coordinator HTTPS URL",text:$url).textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.URL)
            TextField("Single-use enrollment invite",text:$invite).textInputAutocapitalization(.never).autocorrectionDisabled()
            Button("Enroll installation") {run {
                lab.credentials=["url":url]
                let r=try await lab.request("/v1/enroll",["invite":invite,"platform":"ios"],auth:false)
                var c=r.compactMapValues{$0 as? String};c["url"]=url;try lab.saveCredentials(c);lab.log("enrolled")
                let allowed=try await UNUserNotificationCenter.current().requestAuthorization(options:[.alert,.sound,.badge])
                lab.log("notification_permission",String(allowed));UIApplication.shared.registerForRemoteNotifications()
            }}
            Toggle("Diagnostic local alerts (disable for APNs trials)",isOn:$lab.diagnosticAlerts)
            Picker("Radio role",selection:$bluetooth.role){Text("Both").tag("both");Text("Scanner").tag("central");Text("Advertiser").tag("peripheral")}
            Button("Start 30-minute session + discovery") {run {
                let r=try await lab.request("/v1/session",[:]);lab.locallyPaused=false;lab.session=r["session"] as? [String:Any]
                if let now=r["now"] as? Double {lab.clockOffset=now-Date().timeIntervalSince1970*1000};bluetooth.start()
            }}
            Button("Pause and cancel offer") {bluetooth.stop();lab.locallyPaused=true;profile="";qr=nil;lab.session=nil;lab.offer=nil;run{_ = try await lab.request("/v1/pause",[:]);try await lab.refresh()}}
            Button("Refresh server state") {run {try await lab.refresh();if lab.offer?["state"] as? String == "connected",let id=lab.offer?["id"] as? String {let r=try await lab.request("/v1/offers/\(id)/profile");profile=String(data:try JSONSerialization.data(withJSONObject:r,options:.prettyPrinted),encoding:.utf8) ?? ""}}}
            Text(lab.message)
            Text("Session: \(lab.session?["id"] as? String ?? "paused")\nOffer: \(lab.offer?["state"] as? String ?? "none")")
            if let cue=lab.offer?["cue"] as? String {Text(cue).font(.title2);Text("Briefly show this cue only if comfortable. You can leave at any time.")}
            Button("I'm open to saying hello"){action("ready")}
            Button("Not now"){profile="";qr=nil;action("decline")}
            Button("Show connection QR") {run {
                guard let id=lab.offer?["id"] as? String else{throw lab.failure("No offer")}
                let r=try await lab.request("/v1/offers/\(id)/qr",[:]);challenge=r["challenge"] as? String ?? ""
                let filter=CIFilter.qrCodeGenerator();filter.message=Data(challenge.utf8)
                if let output=filter.outputImage,let cg=CIContext().createCGImage(output.transformed(by:CGAffineTransform(scaleX:8,y:8)),from:output.extent.applying(CGAffineTransform(scaleX:8,y:8))) {qr=UIImage(cgImage:cg)}
            }}
            if let qr=qr {Image(uiImage:qr).interpolation(.none).resizable().scaledToFit().frame(width:240,height:240).accessibilityLabel("Current introduction connection QR")}
            Button("Scan connection QR"){scanning=true}
            TextField("Scanned challenge / manual fallback",text:$challenge).textInputAutocapitalization(.never).autocorrectionDisabled()
            Button("Use scanned challenge") {run {guard let id=lab.offer?["id"] as? String else{throw lab.failure("No offer")};_ = try await lab.request("/v1/offers/\(id)/scan",["challenge":challenge]);try await lab.refresh()}}
            Button("Connect and share synthetic profiles"){action("confirm")}
            Text(profile)
            Button("Disconnect"){profile="";qr=nil;action("disconnect")}
            Button("Block this test pair"){profile="";qr=nil;action("block")}
            ShareLink("Export redacted diagnostics",item:lab.events.joined(separator:"\n"))
            Text(lab.events.suffix(12).joined(separator:"\n")).font(.caption.monospaced())
        }.padding()}
        .sheet(isPresented:$scanning){QRScanner{value in challenge=value;scanning=false}}
        .onChange(of:scenePhase){phase in
            lab.log("app_lifecycle",String(describing:phase))
            if phase == .active && lab.credentials["token"] != nil {run{try await lab.refresh();if lab.session == nil {bluetooth.stop()}}}
            if phase == .background {lab.log("background_limit","No periodic wakeup assumed")}
        }
    }
}
struct QRScanner:UIViewControllerRepresentable {
    var found:(String)->Void
    func makeUIViewController(context:Context)->ScanController {let c=ScanController();c.found=found;return c}
    func updateUIViewController(_ uiViewController:ScanController,context:Context){}
}
class ScanController:UIViewController,AVCaptureMetadataOutputObjectsDelegate {
    var found:((String)->Void)?
    let session=AVCaptureSession()
    var preview:AVCaptureVideoPreviewLayer?
    override func viewDidLoad(){super.viewDidLoad();view.backgroundColor = .black
        AVCaptureDevice.requestAccess(for:.video){allowed in if allowed {DispatchQueue.main.async{self.configure()}}}
    }
    func configure(){
        guard let camera=AVCaptureDevice.default(for:.video),let input=try? AVCaptureDeviceInput(device:camera),session.canAddInput(input) else{return}
        session.addInput(input);let output=AVCaptureMetadataOutput();guard session.canAddOutput(output) else{return};session.addOutput(output)
        output.setMetadataObjectsDelegate(self,queue:.main);output.metadataObjectTypes=[.qr]
        let layer=AVCaptureVideoPreviewLayer(session:session);layer.videoGravity = .resizeAspectFill;layer.frame=view.bounds;view.layer.addSublayer(layer);preview=layer
        DispatchQueue.global(qos:.userInitiated).async{self.session.startRunning()}
    }
    override func viewDidLayoutSubviews(){super.viewDidLayoutSubviews();preview?.frame=view.bounds}
    override func viewWillDisappear(_ animated:Bool){super.viewWillDisappear(animated);DispatchQueue.global().async{self.session.stopRunning()}}
    func metadataOutput(_ output:AVCaptureMetadataOutput,didOutput metadataObjects:[AVMetadataObject],from connection:AVCaptureConnection){if let code=metadataObjects.first as? AVMetadataMachineReadableCodeObject,let text=code.stringValue {found?(text);found=nil}}
}

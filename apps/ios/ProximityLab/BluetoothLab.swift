import Foundation
import CoreBluetooth

final class BluetoothLab: NSObject, ObservableObject, CBCentralManagerDelegate, CBPeripheralManagerDelegate, CBPeripheralDelegate {
    static let shared = BluetoothLab()
    let lab=Lab.shared
    let service=CBUUID(string:"7b9e1000-29c4-4a91-8c65-66d9384a1000")
    let helloID=CBUUID(string:"7b9e1001-29c4-4a91-8c65-66d9384a1000")
    let replyID=CBUUID(string:"7b9e1002-29c4-4a91-8c65-66d9384a1000")
    let finishID=CBUUID(string:"7b9e1003-29c4-4a91-8c65-66d9384a1000")
    var central:CBCentralManager!
    var peripheral:CBPeripheralManager!
    @Published var active=false
    @Published var role="both"
    var peer:CBPeripheral?
    var chars=[CBUUID:CBCharacteristic]()
    var a:[String:Any]?
    var proof:[String:Any]?
    var writing:CBUUID?
    var chunks=[Data]()
    var cooldown=[UUID:Date]()
    var frames=[UUID:Data]()
    var sequences=[UUID:Int]()
    var started=[UUID:Date]()
    var hellos=[UUID:[String:Any]]()
    var replies=[UUID:[String:Any]]()
    var serverAdded=false
    override init() {
        super.init()
        central=CBCentralManager(delegate:self,queue:nil,options:[CBCentralManagerOptionRestoreIdentifierKey:"proximity-central"])
        peripheral=CBPeripheralManager(delegate:self,queue:nil,options:[CBPeripheralManagerOptionRestoreIdentifierKey:"proximity-peripheral"])
    }
    func start() {
        guard lab.session != nil else {lab.log("start_failed","Start server session first");return}
        active=true;configureCentral();configurePeripheral()
        if let until=lab.session?["until"] as? NSNumber { DispatchQueue.main.asyncAfter(deadline:.now()+max(0,Double(until.int64Value-lab.now())/1000)) { [weak self] in
            guard let self=self,let current=self.lab.session?["until"] as? NSNumber,current.int64Value<=self.lab.now() else{return};self.stop();self.lab.locallyPaused=true;self.lab.session=nil
        }}
        lab.log("discovery_started","iOS callbacks; no keepalive or background polling")
    }
    func stop() {
        active=false;central.stopScan();peripheral.stopAdvertising();peripheral.removeAllServices();serverAdded=false
        closePeer();lab.log("discovery_stopped")
    }
    func usable()->Bool {
        guard active,let until=lab.session?["until"] as? NSNumber,until.int64Value>lab.now() else {return false};return true
    }
    func configureCentral() {if role != "peripheral" && usable() && central.state == .poweredOn {central.scanForPeripherals(withServices:[service],options:[CBCentralManagerScanOptionAllowDuplicatesKey:true])}}
    func configurePeripheral() {
        guard role != "central",usable(),peripheral.state == .poweredOn,!serverAdded else{return}
        serverAdded=true
        let svc=CBMutableService(type:service,primary:true)
        svc.characteristics=[CBMutableCharacteristic(type:helloID,properties:.write,value:nil,permissions:.writeable),CBMutableCharacteristic(type:replyID,properties:.read,value:nil,permissions:.readable),CBMutableCharacteristic(type:finishID,properties:.write,value:nil,permissions:.writeable)]
        peripheral.add(svc)
    }
    func centralManagerDidUpdateState(_ central:CBCentralManager) {lab.log("central_state",String(central.state.rawValue));configureCentral()}
    func peripheralManagerDidUpdateState(_ peripheral:CBPeripheralManager) {lab.log("peripheral_state",String(peripheral.state.rawValue));if peripheral.state != .poweredOn {serverAdded=false};configurePeripheral()}
    func peripheralManager(_ peripheral:CBPeripheralManager,didAdd service:CBService,error:Error?) {
        if let e=error {serverAdded=false;lab.log("service_failed",e.localizedDescription);return}
        if usable(){peripheral.startAdvertising([CBAdvertisementDataServiceUUIDsKey:[self.service]])}
    }
    func peripheralManagerDidStartAdvertising(_ peripheral:CBPeripheralManager,error:Error?) {lab.log(error == nil ? "advertising_started":"advertising_failed",error?.localizedDescription ?? "")}
    func centralManager(_ central:CBCentralManager,willRestoreState dict:[String:Any]) {
        lab.log("central_restored","Restored radio state does not restore expired authorization")
        // Session credentials/aliases are deliberately not resurrected blindly.
        for p in dict[CBCentralManagerRestoredStatePeripheralsKey] as? [CBPeripheral] ?? [] {central.cancelPeripheralConnection(p)}
        central.stopScan()
    }
    func peripheralManager(_ peripheral:CBPeripheralManager,willRestoreState dict:[String:Any]) {lab.log("peripheral_restored","Reopen and start a fresh session");peripheral.stopAdvertising();peripheral.removeAllServices();serverAdded=false}
    func centralManager(_ central:CBCentralManager,didDiscover discovered:CBPeripheral,advertisementData:[String:Any],rssi RSSI:NSNumber) {
        guard usable(),peer == nil else{return}
        let id=discovered.identifier
        if let previous=cooldown[id],Date().timeIntervalSince(previous)<10 {return}
        if cooldown.count>100 {cooldown.removeAll()};cooldown[id]=Date()
        lab.log("peer_discovered","rssi=\(RSSI)");peer=discovered;discovered.delegate=self;central.connect(discovered)
        DispatchQueue.main.asyncAfter(deadline:.now()+20) { [weak self,weak discovered] in
            guard let self=self,self.peer === discovered else{return};self.lab.log("exchange_timeout");self.closePeer()
        }
    }
    func centralManager(_ central:CBCentralManager,didConnect peripheral:CBPeripheral) {lab.log("gatt_connected");peripheral.discoverServices([service])}
    func centralManager(_ central:CBCentralManager,didFailToConnect peripheral:CBPeripheral,error:Error?) {lab.log("connect_failed",error?.localizedDescription ?? "");if peer === peripheral {closePeer()}}
    func centralManager(_ central:CBCentralManager,didDisconnectPeripheral peripheral:CBPeripheral,error:Error?) {
        if peer === peripheral {peer=nil;chars.removeAll();chunks.removeAll()}
        lab.log("gatt_disconnected",error?.localizedDescription ?? "")
        // Best effort follow-up while OS permits execution; no promise of timer wakeup.
        DispatchQueue.main.asyncAfter(deadline:.now()+10) { [weak self,weak peripheral] in
            guard let self=self,let p=peripheral,self.usable(),self.peer == nil else{return}
            self.peer=p;p.delegate=self;self.central.connect(p)
            DispatchQueue.main.asyncAfter(deadline:.now()+20) { [weak self,weak p] in if self?.peer === p {self?.closePeer()} }
        }
    }
    func peripheral(_ peripheral:CBPeripheral,didDiscoverServices error:Error?) {
        guard error == nil,let s=peripheral.services?.first(where:{$0.uuid==service}) else {lab.log("services_failed");closePeer();return}
        peripheral.discoverCharacteristics([helloID,replyID,finishID],for:s)
    }
    func peripheral(_ peripheral:CBPeripheral,didDiscoverCharacteristicsFor service:CBService,error:Error?) {
        do {
            guard error == nil,let discovered=service.characteristics else {throw lab.failure("Characteristics unavailable")}
            chars=Dictionary(uniqueKeysWithValues:discovered.map{($0.uuid,$0)})
            guard chars.count==3 else{throw lab.failure("Incomplete service")}
            a=try lab.hello();try send(helloID,a!)
        } catch {lab.log("exchange_failed",error.localizedDescription);closePeer()}
    }
    func send(_ id:CBUUID,_ object:[String:Any]) throws {
        guard let p=peer else{throw lab.failure("No connection")}
        let data=try JSONSerialization.data(withJSONObject:object,options:.sortedKeys)
        guard data.count<=4096 else{throw lab.failure("Payload too large")}
        let size=min(180,p.maximumWriteValueLength(for:.withResponse)-2)
        guard size>0 else{throw lab.failure("Invalid MTU")}
        writing=id;chunks=[]
        // 18 bytes guarantees interoperability without an MTU negotiation dependency.
        let payload=min(18,size)
        for offset in stride(from:0,to:data.count,by:payload) {
            let end=min(offset+payload,data.count)
            chunks.append(Data([UInt8(offset/payload),end==data.count ? 1:0])+data.subdata(in:offset..<end))
        }
        writeNext()
    }
    func writeNext() {
        guard let p=peer,let id=writing,let c=chars[id],!chunks.isEmpty else{return}
        p.writeValue(chunks.removeFirst(),for:c,type:.withResponse)
    }
    func peripheral(_ peripheral:CBPeripheral,didWriteValueFor characteristic:CBCharacteristic,error:Error?) {
        if let e=error {lab.log("write_failed",e.localizedDescription);closePeer();return}
        if !chunks.isEmpty {writeNext();return}
        if writing==helloID,let c=chars[replyID] {peripheral.readValue(for:c)}
        else if writing==finishID {if let proof=proof {lab.submit(proof)};lab.log("exchange_complete","central");closePeer()}
    }
    func peripheral(_ peripheral:CBPeripheral,didUpdateValueFor characteristic:CBCharacteristic,error:Error?) {
        do {
            guard error == nil,let value=characteristic.value,let b=try JSONSerialization.jsonObject(with:value) as? [String:Any],let a=a else{throw lab.failure("Invalid peer reply")}
            let result:[String:Any]=["a":a,"b":b,"sigA":try lab.sign(lab.transcript(a,b))]
            proof=result;try send(finishID,result)
        } catch {lab.log("reply_failed",error.localizedDescription);closePeer()}
    }
    func peripheralManager(_ peripheral:CBPeripheralManager,didReceiveWrite requests:[CBATTRequest]) {
        guard usable() else {if let first=requests.first {peripheral.respond(to:first,withResult:.insufficientAuthorization)};return}
        do {
            for request in requests {
                guard let value=request.value,value.count>=2,request.offset==0 else{throw lab.failure("Invalid frame")}
                let id=request.central.identifier;let seq=Int(value[0])
                if seq==0 {guard frames.count<8 || frames[id] != nil else{throw lab.failure("Too many peers")};frames[id]=Data();sequences[id]=0;started[id]=Date()}
                guard sequences[id]==seq,let began=started[id],Date().timeIntervalSince(began)<30 else{throw lab.failure("Invalid sequence")}
                frames[id]?.append(value.dropFirst(2));sequences[id]=seq+1
                guard let data=frames[id],data.count<=4096 else{throw lab.failure("Invalid length")}
                if value[1]==1 {
                    frames.removeValue(forKey:id);sequences.removeValue(forKey:id);started.removeValue(forKey:id)
                    guard let object=try JSONSerialization.jsonObject(with:data) as? [String:Any] else{throw lab.failure("Invalid JSON")}
                    if request.characteristic.uuid==helloID {
                        var b=try lab.hello();b["sig"]=try lab.sign(lab.transcript(object,b));hellos[id]=object;replies[id]=b;lab.log("hello_received")
                    } else if request.characteristic.uuid==finishID {
                        guard let a=object["a"] as? NSDictionary,let b=object["b"] as? NSDictionary,
                              a.isEqual(to:hellos[id] ?? [:]),b.isEqual(to:replies[id] ?? [:]) else{throw lab.failure("Transcript changed")}
                        lab.submit(object);lab.log("exchange_complete","peripheral");hellos.removeValue(forKey:id);replies.removeValue(forKey:id)
                    } else {throw lab.failure("Unknown characteristic")}
                }
            }
            if let first=requests.first {peripheral.respond(to:first,withResult:.success)}
        } catch {lab.log("write_rejected",error.localizedDescription);if let first=requests.first {peripheral.respond(to:first,withResult:.invalidAttributeValueLength)}}
    }
    func peripheralManager(_ peripheral:CBPeripheralManager,didReceiveRead request:CBATTRequest) {
        guard usable(),request.characteristic.uuid==replyID,let reply=replies[request.central.identifier],let data=try? JSONSerialization.data(withJSONObject:reply,options:.sortedKeys),request.offset<=data.count else{peripheral.respond(to:request,withResult:.invalidOffset);return}
        request.value=data.subdata(in:request.offset..<data.count);peripheral.respond(to:request,withResult:.success)
    }
    func closePeer() {if let p=peer {central.cancelPeripheralConnection(p)};peer=nil;chars.removeAll();chunks.removeAll();a=nil;proof=nil}
}

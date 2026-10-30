"""Generate the small Xcode project without requiring XcodeGen. No signing secrets."""
from pathlib import Path
import hashlib
import plistlib
import json
root = Path(__file__).resolve().parents[2] / 'apps' / 'ios'
project = root / 'ProximityLab.xcodeproj'
project.mkdir(exist_ok=True)
def uid(s): return hashlib.sha256(s.encode()).hexdigest()[:24].upper()
objects = {}
def obj(key_name, **fields):
    key = uid(key_name)
    objects[key] = fields
    return key
refs=[]; builds=[]
for name in sorted(p.name for p in (root/'ProximityLab').glob('*.swift')):
    ref=obj('ref-'+name, isa='PBXFileReference', lastKnownFileType='sourcecode.swift',path=name,sourceTree='<group>')
    refs.append(ref); builds.append(obj('build-'+name,isa='PBXBuildFile',fileRef=ref))
info=obj('info',isa='PBXFileReference',lastKnownFileType='text.plist.xml',path='Info.plist',sourceTree='<group>')
app=obj('app',isa='PBXFileReference',explicitFileType='wrapper.application',includeInIndex='0',path='ProximityLab.app',sourceTree='BUILT_PRODUCTS_DIR')
sourcegroup=obj('sources',isa='PBXGroup',children=refs+[info],path='ProximityLab',sourceTree='<group>')
products=obj('products',isa='PBXGroup',children=[app],name='Products',sourceTree='<group>')
main=obj('main',isa='PBXGroup',children=[sourcegroup,products],sourceTree='<group>')
sources=obj('sourcephase',isa='PBXSourcesBuildPhase',buildActionMask='2147483647',files=builds,runOnlyForDeploymentPostprocessing='0')
frameworks=obj('frameworkphase',isa='PBXFrameworksBuildPhase',buildActionMask='2147483647',files=[],runOnlyForDeploymentPostprocessing='0')
resources=obj('resourcephase',isa='PBXResourcesBuildPhase',buildActionMask='2147483647',files=[],runOnlyForDeploymentPostprocessing='0')
projectconfigs=[]; targetconfigs=[]
for name in ['Debug','Release']:
    common={'SDKROOT':'iphoneos','IPHONEOS_DEPLOYMENT_TARGET':'16.0','SWIFT_VERSION':'5.0','CLANG_ENABLE_MODULES':'YES','SWIFT_OPTIMIZATION_LEVEL':'-Onone' if name=='Debug' else '-O'}
    projectconfigs.append(obj('project'+name,isa='XCBuildConfiguration',name=name,buildSettings=common))
    settings={'PRODUCT_NAME':'$(TARGET_NAME)','PRODUCT_BUNDLE_IDENTIFIER':'ca.proximity.lab','INFOPLIST_FILE':'ProximityLab/Info.plist','GENERATE_INFOPLIST_FILE':'NO','CODE_SIGN_STYLE':'Automatic','TARGETED_DEVICE_FAMILY':'1','SWIFT_EMIT_LOC_STRINGS':'YES','CURRENT_PROJECT_VERSION':'1','MARKETING_VERSION':'0.1.0'}
    targetconfigs.append(obj('target'+name,isa='XCBuildConfiguration',name=name,buildSettings=settings))
pc=obj('projectconfiglist',isa='XCConfigurationList',buildConfigurations=projectconfigs,defaultConfigurationIsVisible='0',defaultConfigurationName='Release')
tc=obj('targetconfiglist',isa='XCConfigurationList',buildConfigurations=targetconfigs,defaultConfigurationIsVisible='0',defaultConfigurationName='Release')
target=obj('target',isa='PBXNativeTarget',name='ProximityLab',productName='ProximityLab',productType='com.apple.product-type.application',productReference=app,buildConfigurationList=tc,buildPhases=[sources,frameworks,resources],buildRules=[],dependencies=[])
pr=obj('project',isa='PBXProject',attributes={'LastUpgradeCheck':'1600','TargetAttributes':{target:{'CreatedOnToolsVersion':'16.0'}}},buildConfigurationList=pc,compatibilityVersion='Xcode 14.0',developmentRegion='en',knownRegions=['en','Base'],mainGroup=main,productRefGroup=products,projectDirPath='',projectRoot='',targets=[target])
def encode(value):
    if isinstance(value,dict):return '{\n'+''.join(f'{json.dumps(k)} = {encode(v)};\n' for k,v in value.items())+'}'
    if isinstance(value,list):return '(\n'+''.join(encode(v)+',\n' for v in value)+')'
    return json.dumps(value)
(project/'project.pbxproj').write_text('// !$*UTF8*$!\n'+encode({'archiveVersion':'1','classes':{},'objectVersion':'56','objects':objects,'rootObject':pr})+'\n')
info={'CFBundleDevelopmentRegion':'en','CFBundleExecutable':'$(EXECUTABLE_NAME)','CFBundleIdentifier':'$(PRODUCT_BUNDLE_IDENTIFIER)','CFBundleInfoDictionaryVersion':'6.0','CFBundleName':'$(PRODUCT_NAME)','CFBundlePackageType':'APPL','CFBundleDisplayName':'Proximity Lab','CFBundleShortVersionString':'0.1.0','CFBundleVersion':'1','LSRequiresIPhoneOS':True,'UILaunchScreen':{},'UIApplicationSceneManifest':{'UIApplicationSupportsMultipleScenes':False,'UISceneConfigurations':{}},'UISupportedInterfaceOrientations':['UIInterfaceOrientationPortrait'],'NSBluetoothAlwaysUsageDescription':'Detect enrolled test phones nearby during a voluntary experiment.','NSCameraUsageDescription':"Scan the current introduction's connection QR.",'NSLocalNetworkUsageDescription':'Connect to your test coordinator on the same Wi-Fi during proximity experiments.','UIBackgroundModes':['bluetooth-central','bluetooth-peripheral'],'NSAppTransportSecurity':{'NSAllowsLocalNetworking':True}}
(root/'ProximityLab'/'Info.plist').write_bytes(plistlib.dumps(info))
scheme=f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1600" version="1.3"><BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{target}" BuildableName="ProximityLab.app" BlueprintName="ProximityLab" ReferencedContainer="container:ProximityLab.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction><LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="NO"><BuildableProductRunnable runnableDebuggingMode="0"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{target}" BuildableName="ProximityLab.app" BlueprintName="ProximityLab" ReferencedContainer="container:ProximityLab.xcodeproj"/></BuildableProductRunnable></LaunchAction><ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"/><AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/></Scheme>'''
p=project/'xcshareddata'/'xcschemes';p.mkdir(parents=True,exist_ok=True);(p/'ProximityLab.xcscheme').write_text(scheme)
print('Generated checked-in Xcode project and Info.plist; select your own signing team in Xcode.')

fn main() {
    let target = std::env::var("TARGET").unwrap_or_default();
    if target.contains("apple-darwin") || target.contains("ios") {
        println!("cargo:rerun-if-changed=src/commands/app_attest.m");
        println!("cargo:rerun-if-changed=src/commands/app_attest.h");
        println!("cargo:rustc-link-lib=framework=DeviceCheck");
        println!("cargo:rustc-link-lib=framework=Foundation");
        cc::Build::new()
            .file("src/commands/app_attest.m")
            .flag("-fobjc-arc")
            .compile("nexus_app_attest");
    }
    tauri_build::build()
}

use std::{env, path::Path, process::Command};

fn git(root: &Path, args: &[&str]) -> Option<String> {
    let output = Command::new("git")
        .arg("-c")
        .arg(format!("safe.directory={}", root.to_string_lossy().replace('\\', "/")))
        .args(args)
        .current_dir(root)
        .output()
        .ok()?;
    output.status.success().then(|| String::from_utf8_lossy(&output.stdout).trim().to_owned())
}

fn main() {
    let manifest = env::var("CARGO_MANIFEST_DIR").expect("Cargo supplies the manifest directory");
    let root = Path::new(&manifest).parent().expect("the app has a repository directory");

    // Static frontend assets are embedded in the executable. A frontend-only edit
    // must rebuild it too, even when Cargo sees no changed Rust source.
    for path in ["build.rs", "src", "../src", "Cargo.toml", "Cargo.lock", "tauri.conf.json"] {
        println!("cargo:rerun-if-changed={path}");
    }
    // Watch Git state as well so a commit, checkout, or staging operation refreshes
    // the identity. rev-parse also resolves paths for linked worktrees.
    let mut git_paths = vec!["HEAD".to_owned(), "index".to_owned(), "packed-refs".to_owned()];
    if let Some(reference) = git(root, &["symbolic-ref", "-q", "HEAD"]) {
        git_paths.push(reference);
    }
    for path in git_paths {
        if let Some(path) = git(root, &["rev-parse", "--git-path", &path]) {
            let path = root.join(path);
            if path.exists() {
                println!("cargo:rerun-if-changed={}", path.display());
            }
        }
    }
    let revision = git(root, &["rev-parse", "--short=8", "HEAD"])
        .map(|sha| match git(root, &["status", "--porcelain", "--untracked-files=normal"]) {
            Some(status) if !status.is_empty() => format!("{sha}-dirty"),
            Some(_) => sha,
            None => format!("{sha}-unknown"),
        })
        .unwrap_or_else(|| "unknown".to_owned());
    println!("cargo:rustc-env=POCKETPET_REVISION={revision}");
    println!("cargo:rustc-env=POCKETPET_BUILD_PROFILE={}", env::var("PROFILE").unwrap_or_else(|_| "unknown".to_owned()));
    tauri_build::build()
}

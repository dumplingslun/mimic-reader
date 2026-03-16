use std::env;
use std::fs;
use std::path::PathBuf;

fn ensure_frontend_dist_exists() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap_or_else(|_| ".".into()));
    let dist_dir = manifest_dir.join("../dist");

    if let Err(error) = fs::create_dir_all(&dist_dir) {
        panic!(
            "Failed to create frontendDist directory at {}: {}",
            dist_dir.display(),
            error
        );
    }

    let index_html = dist_dir.join("index.html");
    if !index_html.exists() {
        let placeholder = r#"<!doctype html>
<html lang=\"en\">
  <head>
    <meta charset=\"UTF-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
    <title>MimicReader</title>
  </head>
  <body>
    <div id=\"app\">Frontend not built yet. Run `npm run build`.</div>
  </body>
</html>
"#;

        if let Err(error) = fs::write(&index_html, placeholder) {
            panic!(
                "Failed to create placeholder frontendDist entry at {}: {}",
                index_html.display(),
                error
            );
        }
    }
}

fn main() {
    ensure_frontend_dist_exists();
    tauri_build::build()
}

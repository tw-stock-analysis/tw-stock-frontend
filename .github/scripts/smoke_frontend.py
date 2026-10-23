"""Check the built Nginx image without depending on another repository or TWSE."""

import argparse
import re
import subprocess
import time
from urllib.error import HTTPError, URLError
from urllib.request import ProxyHandler, build_opener
from uuid import uuid4


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image")
    image = parser.parse_args().image
    container = f"twstock-frontend-ci-{uuid4().hex[:12]}"
    opener = build_opener(ProxyHandler({}))

    def docker(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
        result = subprocess.run(["docker", *args], capture_output=True, text=True, timeout=120)
        if check and result.returncode:
            raise RuntimeError(f"Docker command failed: {result.stderr}")
        return result

    def get(path: str):
        try:
            response = opener.open(base + path, timeout=5)
        except HTTPError as error:
            response = error
        with response:
            return response.status, response.headers, response.read()

    try:
        docker(
            "run",
            "--detach",
            "--name",
            container,
            "--publish",
            "127.0.0.1::80",
            image,
        )
        port = docker("port", container, "80/tcp").stdout.strip().rsplit(":", 1)[1]
        base = f"http://127.0.0.1:{port}"
        deadline = time.monotonic() + 30
        while True:
            try:
                status, headers, index = get("/index.html")
                if status == 200:
                    break
            except (OSError, URLError):
                pass
            if time.monotonic() >= deadline:
                raise RuntimeError("Nginx did not become ready")
            time.sleep(1)
        for path in ("/", "/login", "/account/sessions", "/stocks/2330"):
            status, headers, body = get(path)
            assert status == 200 and headers.get_content_type() == "text/html"
            assert b'<div id="root"></div>' in body
            assert headers["Cache-Control"] == "no-cache"
        assets = re.findall(rb'(?:src|href)="(/assets/[^"]+)"', index)
        assert assets
        for asset in assets:
            status, headers, _ = get(asset.decode())
            assert status == 200 and headers.get_content_type() != "text/html"
            assert "immutable" in headers["Cache-Control"]
        assert get("/assets/nonexistent.js")[0] == 404
        print("Nginx image: SPA routes, real assets, cache headers and missing-asset 404 passed")
    except BaseException:
        result = docker("logs", "--tail", "100", container, check=False)
        print(result.stdout)
        print(result.stderr)
        raise
    finally:
        docker("rm", "--force", container, check=False)


if __name__ == "__main__":
    main()

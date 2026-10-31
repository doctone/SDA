"""Deploy the tested commit and wait for Render's pre-deploy migration and worker."""
import json
import os
import time
import urllib.request


def request(path, body=None):
    req = urllib.request.Request(
        "https://api.render.com/v1/" + path,
        data=None if body is None else json.dumps(body).encode(),
        headers={
            "Authorization": "Bearer " + os.environ["RENDER_API_KEY"],
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def main():
    service = "services/" + os.environ["RENDER_SERVICE_ID"]
    if request(service).get("autoDeploy") != "no":
        raise RuntimeError("Disable Render Auto-Deploy before enabling the release pipeline")
    deployment = request(service + "/deploys", {"commitId": os.environ["GITHUB_SHA"]})
    deploy_id = deployment["id"]
    print("Render deployment: " + deploy_id, flush=True)
    deadline = time.monotonic() + 1200
    while time.monotonic() < deadline:
        status = request(service + "/deploys/" + deploy_id)["status"]
        print("Render status: " + status, flush=True)
        if status == "live":
            return
        if status not in {"created", "queued", "build_in_progress", "pre_deploy_in_progress", "update_in_progress"}:
            raise RuntimeError("Render deployment stopped: " + status)
        time.sleep(10)
    raise TimeoutError("Render deployment did not become live within 20 minutes; inspect it before retrying")


if __name__ == "__main__":
    main()

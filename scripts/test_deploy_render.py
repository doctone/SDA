import os
import unittest
from unittest.mock import patch

import deploy_render


class RenderDeployTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"RENDER_SERVICE_ID": "srv-test", "GITHUB_SHA": "tested-sha"})
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_waits_for_live_and_deploys_tested_commit(self):
        with patch.object(deploy_render, "request", side_effect=[
            {"autoDeploy": "no"}, {"id": "dep-test"},
            {"status": "pre_deploy_in_progress"}, {"status": "live"},
        ]) as request, patch.object(deploy_render.time, "sleep"):
            deploy_render.main()
            self.assertEqual(request.call_args_list[1].args, (
                "services/srv-test/deploys", {"commitId": "tested-sha"},
            ))
            self.assertEqual(request.call_count, 4)

    def test_failed_migration_blocks_release(self):
        with patch.object(deploy_render, "request", side_effect=[
            {"autoDeploy": "no"}, {"id": "dep-test"}, {"status": "pre_deploy_failed"},
        ]):
            with self.assertRaisesRegex(RuntimeError, "pre_deploy_failed"):
                deploy_render.main()

    def test_refuses_competing_automatic_deploys(self):
        with patch.object(deploy_render, "request", return_value={"autoDeploy": "yes"}) as request:
            with self.assertRaisesRegex(RuntimeError, "Disable Render"):
                deploy_render.main()
            self.assertEqual(request.call_count, 1)

    def test_timeout_fails_release(self):
        with patch.object(deploy_render, "request", side_effect=[
            {"autoDeploy": "no"}, {"id": "dep-test"},
        ]), patch.object(deploy_render.time, "monotonic", side_effect=[0, 1201]):
            with self.assertRaises(TimeoutError):
                deploy_render.main()


if __name__ == "__main__":
    unittest.main()

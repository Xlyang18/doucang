#!/bin/bash
# 全量测试：单元 + 集成（真实 HTTP / 真实 xlsx / 真实 Vision）
set -u
cd "/Users/xlyang/Documents/appZoo/豆藏"
node --test tests/*.test.mjs > /tmp/visiontest/test-full.log 2>&1
CODE=$?
grep -E "^(✔|✖|ℹ)" /tmp/visiontest/test-full.log
echo "EXIT=$CODE"

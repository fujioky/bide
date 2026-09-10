"""让 tests/ 下的用例能直接 import bide（app 目录不装成包，运行时靠 sys.path）。"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../packages/fujioky-auth/src")))

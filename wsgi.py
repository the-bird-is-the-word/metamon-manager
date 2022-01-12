import os
os.environ["MM_MODE"] = "prod"

from mm import app

if __name__ == "__main__":
    app.run()
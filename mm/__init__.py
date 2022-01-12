"""
Resources:
Mixing Flask with MetaMask
https://github.com/pierce403/simple-flask-metamask

Overview of accessing MetaMask via browser
https://docs.metamask.io/guide/ethereum-provider.html#methods

Table in Bootstrap:
https://live.bootstrap-table.com/example/welcome.html
"""
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask import Flask
from flask_session import Session
from flask_mobility import Mobility
from web3 import Web3
import logging
from datetime import datetime
from settings import *

app = Flask(__name__,
            template_folder=str(PATH_TEMPLATES),
            static_folder=str(main_path / "static"))
app.config["SECRET_KEY"] = SECRET_KEY

# Database
app.config['SQLALCHEMY_DATABASE_URI'] = PATH_DB
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# JSON Web Tokens
app.config['JWT_SECRET_KEY'] = JWT_SECRET_KEY
app.config['JWT_TOKEN_LOCATION'] = ['cookies']
app.config['JWT_COOKIE_SECURE'] = True
app.config['JWT_COOKIE_CSRF_PROTECT'] = True
app.config["JWT_COOKIE_SAMESITE"] = "Strict"
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = JWT_ACCESS_TOKEN_EXPIRES
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = JWT_REFRESH_TOKEN_EXPIRES
app.config["JWT_ACCESS_CSRF_COOKIE_NAME"] = "csrf_access_token"
jwt = JWTManager(app)

# Session
app.secret_key = SESSION_SECRET_KEY
app.config['SESSION_TYPE'] = 'filesystem'
Session(app)

# Mobility
Mobility(app)

# Web3
w3 = Web3(Web3.HTTPProvider(RPC_SERVER))

# Logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

log_path = main_path / "logs"
if not log_path.exists():
    log_path.mkdir()
logger.addHandler(logging.FileHandler(
    str(log_path / f"log_{datetime.utcnow().isoformat(' ', 'seconds').replace(':', '-')}")))

from mm import routes
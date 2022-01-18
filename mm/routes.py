from flask import render_template, request, redirect, url_for, jsonify, abort, flash, session, \
    Response, make_response
from jwt.exceptions import ExpiredSignatureError
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, verify_jwt_in_request, set_access_cookies, unset_jwt_cookies, get_csrf_token, get_jwt
from flask_jwt_extended.exceptions import NoAuthorizationError
import json
import traceback
from datetime import datetime, timedelta
import mimetypes
mimetypes.init()
from eth_account.messages import defunct_hash_message
from mm import app, HOST_URL, w3, db, logger
from mm.models import Battle, Metamon, DailyStats

RESHOW_CONSENT_AFTER = timedelta(days=14)


def fix_mime_types():
    # Fix MIME types of JavScript
    # See https://github.com/encode/starlette/issues/829
    mimetypes.add_type('application/javascript', '.js')
    mimetypes.add_type('text/css', '.css')
    mimetypes.add_type('image/svg+xml', '.svg')


def consent_given(session):
    if session:
        if "consent" in session.keys():
            return session["consent"]
    return False


def show_consent_toast(session):
    cg = consent_given(session)
    # It needs to be checked if cg is not "NOT_REQUIRED"
    if cg == True:
        con_set = session.get("consent_set")
        if isinstance(con_set, datetime):
            if datetime.utcnow() - con_set >= RESHOW_CONSENT_AFTER:
                return True
    # Also handles the case of "NOT_REQUIRED"
    return not cg


@app.route("/about")
def about_page():
    fix_mime_types()
    try:
        verify_jwt_in_request()
    except:
        wallet = None
    else:
        wallet = get_jwt_identity()

    return render_template("about.html", wallet=wallet, show_consent=show_consent_toast(session))


@app.route("/faqs")
def faq_page():
    fix_mime_types()
    try:
        verify_jwt_in_request()
    except:
        wallet = None
    else:
        wallet = get_jwt_identity()

    return render_template("faqs.html", wallet=wallet, show_consent=show_consent_toast(session))


@app.route("/privacy-notice")
def privacy_notice_page():
    fix_mime_types()
    try:
        verify_jwt_in_request()
    except:
        wallet = None
    else:
        wallet = get_jwt_identity()

    return render_template("privacy-notice.html", wallet=wallet, show_consent=show_consent_toast(session))


@app.route("/imprint")
def imprint_page():
    fix_mime_types()
    try:
        verify_jwt_in_request()
    except:
        wallet = None
    else:
        wallet = get_jwt_identity()

    return render_template("imprint.html", wallet=wallet, show_consent=show_consent_toast(session))


@app.route("/")
@app.route("/index")
def index_page():
    fix_mime_types()

    try:
        verify_jwt_in_request()
    except NoAuthorizationError:
        return render_template("index.html", show_consent=show_consent_toast(session))
    except ExpiredSignatureError:
        response = Response()
        unset_jwt_cookies(response)
        response.set_data(render_template("index.html", show_consent=show_consent_toast(session)))
        return response

    wallet = get_jwt_identity()
    return render_template("index.html", wallet=wallet, show_consent=show_consent_toast(session))


@app.route('/login', methods=['POST'])
def login_page():
    consent = consent_given(session)

    if not consent:
        flash("It seems you are in the European Union. You need to accept cookies to connect your wallet", "danger")
        return jsonify({"status": "failed"})

    try:
        public_address = request.json["address"]
        msg = request.json["message"]
        signature = request.json["signature"]
    except:
        flash("Cannot read login post message", "danger")
        abort(401, "Cannot read login post message")

    # Check signed message
    message_hash = defunct_hash_message(text=msg)
    signer = w3.eth.account.recoverHash(message_hash, signature=signature)
    signer = signer.lower()

    if signer == public_address:
        # Authentication
        access_token = create_access_token(identity=public_address)

        session["signature"] = signature
        session["msg"] = msg

        response = redirect(url_for('index_page'))
        set_access_cookies(response, access_token)
        # response.set_data(render_template(url_for("index_page"), additional_scripts=
        # '<script> document.addEventListener("DOMContentLoaded", function(event) { location.reload();  }); </script> '))
        return response
    else:
        logger.info(f"Logging in failed, public address: {public_address}, signer {signer}")
        flash("Authentication failed!", category="danger")
        abort(401, 'Could not authenticate signature!')


@app.route('/logout', methods=['GET'])
@jwt_required()
def logout_page():
    response = redirect(url_for('index_page'))

    # Delete session data if available
    if "signature" in session.keys():
        del session["signature"]
    if "msg" in session.keys():
        del session["msg"]

    # Unset JWT acccess cookie
    unset_jwt_cookies(response)
    response.set_data(render_template("index.html", show_consent=show_consent_toast(session)))
    return response


@app.route("/battle", methods=['GET'])
def autoplay_page():
    fix_mime_types()
    try:
        verify_jwt_in_request()
    except (NoAuthorizationError, ExpiredSignatureError):
        wallet = None
    else:
        wallet = get_jwt_identity()

    session_msg = session.get("msg", None)
    session_sign = session.get("signature", None)

    if wallet and (session_msg is None or session_msg is None):
        logger.info(f"Could not establish session for wallet {wallet}")
        return logout_page()

    if wallet is None:
        flash("You need to connect your wallet to use Metamon Manager!", category="danger")

    return render_template("manager.html", wallet=wallet, msg=session_msg, sign=session_sign,
                           show_consent=show_consent_toast(session))


@app.route("/stats", methods=['POST'])
def stats_post():
    try:
        verify_jwt_in_request()
    except NoAuthorizationError:
        return jsonify({"status": "failed"})

    wallet = get_jwt_identity()

    stats, mtm_stats, save_statistics = request.json

    for mtm_stat in mtm_stats:
        # 1. Save info about a metamon if not already in the database
        metamon_id = mtm_stat["metamon_id"]

        mtm = Metamon.query.filter_by(metamon_id=metamon_id).first()
        # If there exists an entry already, update it
        if mtm:
            mtm.metamon_level = mtm_stat["metamon_level"]
            mtm.experience = mtm_stat["experience"]
            mtm.league_level = mtm_stat["league_level"]
        else:
            mtm_data = {key: mtm_stat[key] for key in ["metamon_id", "rarity", "power", "metamon_level", "experience", "league_level"]}
            mtm_new = Metamon(**mtm_data)
            db.session.add(mtm_new)

        # 2. Save info about battles
        battle_data = {key: mtm_stat[key] for key in ["timestamp", "metamon_id", "battles", "won", "fragments", "league_level", "metamon_level"]}
        battle_data.update({"wallet": wallet})
        battle = Battle(**battle_data)
        db.session.add(battle)

    # 3. Daily stats on minted eggs
    daily = DailyStats(timestamp=stats["timestamp"], minted_eggs=stats["minted_eggs"])
    db.session.add(daily)

    # Commit all
    try:
        db.session.commit()
    except Exception as e:
        tb = '\n'.join(traceback.format_tb(e.__traceback__))
        logger.warning(f"Exception committing to database \n{tb}")
        return jsonify({"status": "failed"})
    else:
        return jsonify({"status": "success"})


@app.route("/statistics", methods=['GET'])
def statistics_page():
    fix_mime_types()
    try:
        verify_jwt_in_request()
    except (NoAuthorizationError, ExpiredSignatureError):
        wallet = None
        flash("You need to connect your wallet to use Metamon Manager!", category="danger")
    else:
        wallet = get_jwt_identity()

    return render_template("statistics.html", wallet=wallet, show_consent=show_consent_toast(session))


@app.route("/data/metamons.json", methods=['GET'])
def metamons_json_data():
    try:
        verify_jwt_in_request()
    except NoAuthorizationError:
        return

    wallet = get_jwt_identity()

    wallet_battles = Battle.query.filter_by(wallet=wallet).all()
    metamon_ids = sorted(list(set([record.metamon_id for record in wallet_battles])))

    # Gather data used in tables
    data = []
    for metamon_id in metamon_ids:
        metamon = Metamon.query.filter_by(metamon_id=metamon_id).first()
        # We should have found a corresponding metamon
        if metamon is None:
            logger.warning(f"Error: Metamon {metamon_id} should be available but is not...")
            continue

        battles = Battle.query.filter_by(wallet=wallet, metamon_id=metamon_id).all()

        total_battles = sum([battle.battles for battle in battles])
        won = sum([battle.won for battle in battles])
        win_perc = won/total_battles
        fragments = sum([battle.fragments for battle in battles])
        last = max([battle.timestamp for battle in battles])

        row = {"metamon_id": metamon_id, "rarity": metamon.rarity, "power": metamon.power,
               "metamon_level": metamon.metamon_level,
               "experience": metamon.experience, "battles": total_battles, "won": won, "win%": f"{win_perc:.1%}",
               "fragments": fragments, "last": last}
        data.append(row)

    json_data = json.dumps(data)
    return json_data


@app.route("/consent", methods=['POST'])
def consent():
    try:
        consent = request.json["consent"]
    except:
        consent = False

    session["consent"] = consent
    session["consent_set"] = datetime.utcnow()

    # resp = make_response(jsonify({"status": "success"}))
    # resp.set_cookie('consent', str(consent))

    return jsonify({"status": "success"})


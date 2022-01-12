import argparse
import requests
import os
import sys
import csv
import pandas as pd
from time import sleep
from datetime import datetime
from random import randrange


class State:
    def __init__(self, wallet):
        self.state = []
        self.max = [0, 0]
        self.wallet = wallet

    def init(self, max1, max2, init_vals=None):
        self.max = [max1, max2]
        self.state = [0]*max1
        if init_vals:
            for n, val in enumerate(init_vals):
                self.state[n] = val

    def set(self, dim, val):
        self.state[dim] = val


# URLs to make api calls
BASE_URL = "https://metamon-api.radiocaca.com/usm-api"
TOKEN_URL = f"{BASE_URL}/login"
LIST_MONSTER_URL = f"{BASE_URL}/getWalletPropertyBySymbol"
CHANGE_FIGHTER_URL = f"{BASE_URL}/isFightMonster"
START_FIGHT_URL = f"{BASE_URL}/startBattle"
LIST_BATTLER_URL = f"{BASE_URL}/getBattelObjects"
WALLET_PROPERTY_LIST = f"{BASE_URL}/getWalletPropertyList"
LVL_UP_URL = f"{BASE_URL}/updateMonster"
MINT_EGG_URL = f"{BASE_URL}/composeMonsterEgg"

MTM_STATS_COLS = ['#', 'League level', 'Total battles', 'Metamon power', 'Metamon level', 'Victories', 'Defeats',
                  'Total egg fragments', 'Timestamp']


def datetime_now():
    return datetime.now().strftime("%m/%d/%Y %H:%M:%S")


def post_formdata(payload, url="", headers=None):
    """Method to send request to game"""
    files = []
    if headers is None:
        headers = {}

    # Add delay to avoid error from too many requests per second
    sleep(0.5)

    for _ in range(5):
        try:
            response = requests.request("POST",
                                        url,
                                        headers=headers,
                                        data=payload,
                                        files=files)
            return response.json()
        except:
            continue
    return {}


def get_battler_score(monster):
    """ Get opponent's power score"""
    return monster["sca"]


def picker_battler(monsters_list, strategy="weakest"):
    """ Picking opponent """
    battlers = list(filter(lambda m: m["rarity"] == "N", monsters_list))

    if len(battlers) == 0:
        battlers = list(filter(lambda m: m["rarity"] == "R", monsters_list))

    if strategy == "weakest":
        return picker_battler_weakest(battlers)
    elif strategy == "random":
        return picker_battler_random(battlers)

def picker_battler_random(battlers):
    num = randrange(len(battlers))
    return battlers[num]

def picker_battler_weakest(battlers):
    battler = battlers[0]
    score_min = get_battler_score(battler)
    for i in range(1, len(battlers)):
        score = get_battler_score(battlers[i])
        if score < score_min:
            battler = battlers[i]
            score_min = score
    return battler

def pick_battle_level(level=1):
    # pick highest league for given level
    if 21 <= level <= 40:
        return 2
    if 41 <= level <= 60:
        return 3
    return 1


class MetamonPlayer:
    def __init__(self,
                 address,
                 sign,
                 msg,
                 update_callback=None):
        self.no_enough_money = False
        self.total_bp_num = 0
        self.total_success = 0
        self.total_fail = 0
        self.mtm_stats_df = pd.DataFrame(columns=MTM_STATS_COLS)
        self.token = None
        self.address = address
        self.sign = sign
        self.msg = msg
        self.battle_progress = State(address)
        self.update_callback = update_callback

    def init_token(self):
        """Obtain token for game session to perform battles and other actions"""
        payload = {"address": self.address, "sign": self.sign, "msg": self.msg}
        response = post_formdata(payload, TOKEN_URL)
        self.token = response.get("data")

    def change_fighter(self, monster_id):
        """Switch to next metamon if you have few"""
        payload = {
            "metamonId": monster_id,
            "address": self.address,
        }
        post_formdata(payload, CHANGE_FIGHTER_URL)

    def list_battlers(self, monster_id, front=1):
        """Obtain list of opponents"""
        payload = {
            "address": self.address,
            "metamonId": monster_id,
            "front": front,
        }
        headers = {
            "accessToken": self.token,
        }
        response = post_formdata(payload, LIST_BATTLER_URL, headers)
        return response.get("data", {}).get("objects")

    def start_fight(self,
                    monster_idx,
                    monster,
                    target_monster_id,
                    loop_count=1,
                    levelup=True):
        """ Main method to initiate battles (as many as monster has energy for)"""
        success = 0
        fail = 0
        total_bp_fragment_num = 0
        my_monster_id = monster.get("id")
        my_monster_token_id = monster.get("tokenId")
        my_level = monster.get("level")
        my_power = monster.get("sca")
        battle_level = pick_battle_level(my_level)
        # Battles already done
        init_num_battles = 20 - monster.get("tear")

        for count in range(loop_count):
            payload = {
                "monsterA": my_monster_id,
                "monsterB": target_monster_id,
                "address": self.address,
                "battleLevel": battle_level,
            }
            headers = {
                "accessToken": self.token,
            }
            response = post_formdata(payload, START_FIGHT_URL, headers)
            code = response.get("code")
            if code == "BATTLE_NOPAY":
                self.no_enough_money = True
                break
            data = response.get("data", {})
            fight_result = data.get("challengeResult", False)
            bp_fragment_num = data.get("bpFragmentNum", 10)

            if levelup:
                # Try to lvl up
                res = post_formdata({"nftId": my_monster_id, "address": self.address},
                                    LVL_UP_URL,
                                    headers)
                code = res.get("code")
                if code == "SUCCESS":
                    # tbar.set_description("LVL UP successful! Continue fighting...")
                    my_level += 1
                    self.total_level_ups += 1
                    # Update league level if new level is 21 or 41
                    battle_level = pick_battle_level(my_level)

            self.total_bp_num += bp_fragment_num
            total_bp_fragment_num += bp_fragment_num
            if fight_result:
                success += 1
                self.total_success += 1
            else:
                fail += 1
                self.total_fail += 1
            # Increase state
            self.battle_progress.set(monster_idx, init_num_battles+count+1)
            self.update_callback(self)

            mtm_stats = {
                "#": my_monster_token_id,
                "League level": battle_level,
                "Total battles": loop_count,
                "Metamon power": my_power,
                "Metamon level": my_level,
                "Victories": success,
                "Defeats": fail,
                "Total egg fragments": total_bp_fragment_num,
                "Timestamp": datetime_now()
            }
            self.mtm_stats_df.loc[mtm_stats["#"]] = mtm_stats
        print(self.mtm_stats_df.iloc[-1])

    def update_wallet_properties(self):
        """ Obtain list of metamons on the wallet"""
        data = []
        page = 1
        while True:
            payload = {"address": self.address, "page": page, "pageSize": 60}
            headers = {
                "accessToken": self.token,
            }
            response = post_formdata(payload, WALLET_PROPERTY_LIST, headers)
            mtms = response.get("data", {}).get("metamonList", [])
            if len(mtms) > 0:
                data.extend(mtms)
                page += 1
            else:
                break
        self.metamons = data
        return data

    def list_monsters(self):
        """ Obtain list of metamons on the wallet (deprecated)"""
        payload = {"address": self.address, "page": 1, "pageSize": 60, "payType": -6}
        headers = {"accessToken": self.token}
        response = post_formdata(payload, LIST_MONSTER_URL, headers)
        monsters = response.get("data", {}).get("data", {})
        return monsters

    def battle(self, monsters, w_name=None, strategy="weakest", levelup=True):
        """ Main method to run all battles for the day"""
        if w_name is None:
            w_name = self.address

        # summary_file_name = f"{w_name}_summary.tsv"
        # mtm_stats_file_name = f"{w_name}_stats.tsv"
        # self.init_token()

        # self.get_wallet_properties()
        # monsters = self.list_monsters()
        wallet_monsters = self.update_wallet_properties()
        print(f"Monsters total: {len(wallet_monsters)}")

        available_monsters = [
            monster for monster in wallet_monsters if monster.get("tear") > 0
        ]

        print(f"Available Monsters : {len(available_monsters)}")
        self.total_level_ups = 0
        for monster_idx, monster in enumerate(monsters):
            # Just in case...
            if monster not in available_monsters:
                continue

            monster_id = monster.get("id")
            tear = monster.get("tear")
            # level = monster.get("level")
            battlers = self.list_battlers(monster_id)
            battler = picker_battler(battlers, strategy)
            target_monster_id = battler.get("id")

            self.change_fighter(monster_id)

            self.start_fight(monster_idx,
                             monster,
                             target_monster_id,
                             loop_count=tear,
                             levelup=levelup)
            if self.no_enough_money:
                print("Not enough u-RACA")
                break
            # Print outs of victories
            print(f"Metamon {monster['tokenId']}: {self.mtm_stats_df.iloc[-1]['Victories']} victories")
        total_count = self.total_success + self.total_fail
        success_percent = .0
        if total_count > 0:
            success_percent = (self.total_success / total_count) * 100

        if total_count <= 0:
            print("No battles to record")
            return

        # Stats of all battles
        stats = {
            "Victories": self.total_success,
            "Defeats": self.total_fail,
            "Win rate": f"{success_percent:.2f}%",
            "Total egg fragments": self.total_bp_num,
            "Level ups": self.total_level_ups,
            "Datetime": datetime_now()
        }
        print(stats)
        # if os.path.exists(summary_file_name) and self.output_stats:
        #     back_fn = f"{summary_file_name}.bak"
        #     os.rename(summary_file_name, back_fn)
        #     tmp_df = pd.read_csv(back_fn, sep="\t", dtype="str")
        #     stats_upd_df = pd.concat([stats_df, tmp_df])
        #     stats_df = stats_upd_df
        #     os.remove(back_fn)

        # if self.output_stats:
        #     stats_df.to_csv(summary_file_name, index=False, sep="\t")

        # Stats for each metamon
        # mtm_stats_df = pd.concat(self.mtm_stats_df)
        # if os.path.exists(mtm_stats_file_name) and self.output_stats:
        #     back_fn = f"{mtm_stats_file_name}.bak"
        #     os.rename(mtm_stats_file_name, back_fn)
        #     tmp_df = pd.read_csv(back_fn, sep="\t", dtype="str")
        #     upd_df = pd.concat([mtm_stats_df, tmp_df])
        #     mtm_stats_df = upd_df
        #     os.remove(back_fn)
        # if self.output_stats:
        #     mtm_stats_df.to_csv(mtm_stats_file_name, sep="\t", index=False)
        return stats, self.mtm_stats_df

    def mint_eggs(self):
        self.init_token()

        headers = {
            "accessToken": self.token,
        }
        payload = {"address": self.address}

        minted_eggs = 0

        while True:
            res = post_formdata(payload, MINT_EGG_URL, headers)
            code = res.get("code")
            if code != "SUCCESS":
                break
            minted_eggs += 1
        print(f"Minted Eggs Total: {minted_eggs}")
        return minted_eggs


if __name__ == "__main__":
    parser = argparse.ArgumentParser()

    parser.add_argument("-i", "--input-tsv", help="Path to tsv file with wallets' "
                                                  "access records (name, address, sign, login message) "
                                                  "name is used for filename with table of results. "
                                                  "Results for each wallet are saved in separate files",
                        default="wallets.tsv", type=str)
    parser.add_argument("-nl", "--no-lvlup", help="Disable automatic lvl up "
                                                  "(if not enough potions/diamonds it will be disabled anyway) "
                                                  "by default lvl up will be attempted after each battle",
                        action="store_true", default=False)
    parser.add_argument("-nb", "--skip-battles", help="No battles, use when need to only mint eggs from shards",
                        action="store_true", default=False)
    parser.add_argument("-e", "--mint-eggs", help="Automatically mint eggs after all battles done for a day",
                        action="store_true", default=False)
    parser.add_argument("-s", "--save-results", help="To enable saving results on disk use this option. "
                                                     "Two files <name>_summary.tsv and <name>_stats.tsv will "
                                                     "be saved in current dir.",
                        action="store_true", default=False)

    args = parser.parse_args()

    if not os.path.exists(args.input_tsv):
        print(f"Input file {args.input_tsv} does not exist")
        sys.exit(-1)

    # determine delimiter char from given input file
    with open(args.input_tsv) as csvfile:
        dialect = csv.Sniffer().sniff(csvfile.readline(), "\t ;,")
        delim = dialect.delimiter

    wallets = pd.read_csv(args.input_tsv, sep=delim)

    auto_lvlup = not args.no_lvlup
    for i, r in wallets.iterrows():
        mtm = MetamonPlayer(address=r.address,
                            sign=r.sign,
                            msg=r.msg)

        if not args.skip_battles:
            mtm.battle(w_name=r["name"], levelup=True)
        if args.mint_eggs:
            mtm.mint_eggs()

import { getRandomInt, error_msg, sleep } from "./utils.js";
import _, { result } from "lodash";

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
};

async function make_request() {
    var kvpairs = {};
    const form = document.getElementById("manager-form");
    for ( var i = 0; i < form.elements.length; i++ ) {
        var e = form.elements[i]; 
        if (e.type == "checkbox")
            kvpairs[e.name] = e.checked ? "on" : "off";
        else
            kvpairs[e.name] = e.value;
    };

    const options = {
        method: 'post',
        credentials: 'same-origin',
        headers: {
          'X-CSRF-TOKEN': getCookie('csrf_access_token'),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(kvpairs)
    };

    await fetch('/manager', options);
};

if (document.getElementById("battle-submit-button")) {
    document.getElementById("battle-submit-button").onclick = async ()=>{
        //await make_request();
        await startBattles();
    };
}

async function fetch_loop(url, method, data, headers) {
    //let h =  {'Content-Type': 'application/json'};
    let h =  {};
	if (headers) {
		Object.assign(h, headers);
	};

	const options = {
        method: method,
        headers: h,
        body: data
    };


	for (let n = 0; n < 5; n++) {
        await sleep(0.5);
		try {
            // await log("Fetch " + url + " " + JSON.stringify(options));
			const response = await fetch(url, options);
            const response_json = await response.json();
            //await log("Response " + JSON.stringify(response_json));
            return response_json;
		} catch (err) {
			await sleep(2);
		}
	}
	
};

function urlencoded(obj) {
    result = _.join(_.map(Object.entries(obj), function(o) {return o[0] + "=" + o[1]}), "&");
    return result;
}

// URLs to make api calls
const BASE_URL = "https://metamon-api.radiocaca.com/usm-api";
const TOKEN_URL = BASE_URL + "/login";
const LIST_MONSTER_URL = BASE_URL + "/getWalletPropertyBySymbol";
const CHANGE_FIGHTER_URL = BASE_URL + "/isFightMonster";
const START_FIGHT_URL = BASE_URL + "/startBattle";
const LIST_BATTLER_URL = BASE_URL + "/getBattelObjects";
const WALLET_PROPERTY_LIST = BASE_URL + "/getWalletPropertyList";
const LVL_UP_URL = BASE_URL + "/updateMonster";
const MINT_EGG_URL = BASE_URL + "/composeMonsterEgg";
const CHECK_BAG_URL = BASE_URL + "/checkBag";

class MetamonIsland {
	constructor(address, sign, msg) {
		this.address = address;
		this.sign = sign;
		this.msg = msg;
		
        this.not_enough_money = false;
        this.total_bp_num = 0;
        this.total_success = 0;
        this.total_fail = 0;
        this.mtm_stats = [];
        this.token = null;
	}
	
	async initToken() {
		const payload = "address=" + this.address + "&sign=" + this.sign + "&msg=" + this.msg + "&network=1";
        const response = await fetch_loop(TOKEN_URL, "post", payload, {"Content-Type": "application/x-www-form-urlencoded"});

        if (response["code"] == "SUCCESS") {
            this.token = response.data.accessToken;
            return true;
        }
        else {
            return false;
        }    
	}
	
    async changeFighter(monster_id) {
        // Switch to next metamon if you have few
        const payload = {
            "metamonId": monster_id,
            "address": this.address,
        };
        await fetch_loop(CHANGE_FIGHTER_URL, "post", urlencoded(payload), this.headersTokenAndCT());
	}
	
	async listOpponents(monster_id, front=1) {
        // Obtain list of opponents
        const payload = {
            "address": this.address,
            "metamonId": monster_id,
            "front": front,
        };

        const response = await fetch_loop(LIST_BATTLER_URL, "post", urlencoded(payload), this.headersTokenAndCT());
        return response["data"]["objects"];
	}

	headersToken () {
		return {"accessToken": this.token};	
	}

    headersTokenAndCT () {
		return {"Content-Type": "application/x-www-form-urlencoded",
                "accessToken": this.token};	
	}

	/**
	Obtain list of Metamons in the wallet
	 */
	async updateWallet() {
        let data = [];
        let page = 1;
        while (true) {
            const payload = {"address": this.address, "page": page, "pageSize": 60};
            const response = await fetch_loop(WALLET_PROPERTY_LIST, "post", urlencoded(payload), this.headersTokenAndCT());
            if (response["code"] != "SUCCESS")
                break;

			const mtms = response["data"]["metamonList"];
            if (mtms.length > 0) {
                // On 18/01/2022 the API seems to be changed
                let added = false;
                for (let mtm of mtms) {
                    if (this.metamon_idx(mtm.tokenId, data) == -1) {
                        data.push(mtm);
                        added = true;
                    }
                }

                if (!added)
                    break;
                
                page += 1;
			}
            else
                break;
		};

        // Sort metamon list
        data.sort((monster1, monster2) => monster1.tokenId - monster2.tokenId);
		
        this.metamons = data;
        return data;
	}

    /**
     * Return the index of a metamon with token monster_token_id in the list of metamons.
     */
    metamon_idx(monster_token_id, metamons) {
        let count = 0;
        for (let monster of metamons) {
            if (monster.tokenId == monster_token_id) {
                return count;
            }
            count++;
        }
        return -1;
    }
	
	/**
	Perform all battles of a list of monsters
	 */
	async battle (monsters, strategy="weakest", levelup=true) {
        // const wallet_monsters = this.updateWallet();
        this.total_level_ups = 0;

        for (let monster of monsters) {
			if (monster.tear == 0)
				continue;

            const tear = monster.tear;
            // level = monster.get("level")
            const battlers = await this.listOpponents(monster.id);
            const battler = MetamonIsland.pickOpponent(battlers, strategy);
            const target_monster_id = battler.id;

            await this.changeFighter(monster.id);
            // Workaround: Pass the index of the monster in the current table
            // This is required because updateMetamonTable uses metamon objects at the beginning of the battles
            // However, the list of metamons in mi gets updated after level ups, thus it would not find the metamons anymore
            const monster_table_idx = this.metamon_idx(monster.tokenId, this.metamons);
            await this.battleMetamon(monster, monster_table_idx, target_monster_id, tear, levelup);

            if (this.not_enough_money)
                break;
		}
        
		const total_count = this.total_success + this.total_fail;
        let success_percent = 0.0;
        if (total_count > 0) {
            success_percent = this.total_success / total_count;
		};

        // Stats of all battles
        const stats = {
            "won": this.total_success,
            "defeats": this.total_fail,
            "win_rate": success_percent,
            "fragments": this.total_bp_num,
            "level_ups": this.total_level_ups,
            "timestamp": Date.now()
        };

        return [stats, this.mtm_stats];
	}
	
    /**
	Main method for battelng with a specific metamon
	 */
	async battleMetamon(monster, monster_table_idx, target_monster_id, loop_count=1, levelup=true) {
        let success = 0;
        let fail = 0;
        let total_bp_fragment_num = 0;
        const my_monster_id = monster.id;
        const my_monster_token_id = parseInt(monster.tokenId);
        let my_level = monster.level;
        const my_power = monster.sca;
        let battle_level = MetamonIsland.pickBattleLevel(my_level);
        const init_tear = monster.tear;
        let experience = monster.exp;
        let exp_to_next = monster.expMax;

        for (let count = 0; count < loop_count; count++) {
            const payload = {
                "monsterA": my_monster_id,
                "monsterB": target_monster_id,
                "address": this.address,
                "battleLevel": battle_level,
            };
            const response = await fetch_loop(START_FIGHT_URL, "post", urlencoded(payload), this.headersTokenAndCT());

            const code = response.code;
            if (code == "BATTLE_NOPAY") {
                this.not_enough_money = true;
				error_msg("Not enough uRACA to play on Metamon Island!", "danger");
                break;
			}
            else if (code == "SUCCESS") {
                const data = response.data;
                const fight_result = data.challengeResult;
                const bp_fragment_num = data.bpFragmentNum;
                const experience_incr = data.challengeExp;

                if (levelup) {
                    // Try to level up
                    const payload = {"nftId": my_monster_id, "address": this.address}
                    const res = await fetch_loop(LVL_UP_URL, "post",  urlencoded(payload), this.headersTokenAndCT());
                    const code = res.code;
                    if (code == "SUCCESS") {
                        my_level += 1;
                        // Update league level if new level is 21 or 41
                        battle_level = MetamonIsland.pickBattleLevel(my_level);
                        this.total_level_ups += 1;
                        experience = experience - exp_to_next;
                        // Now we need to update the metamon to update the expMax field
                        const all_monsters = await this.updateWallet();
                        exp_to_next = all_monsters.find(element => element.tokenId == my_monster_token_id).expMax;
                    };
                };

                this.total_bp_num += bp_fragment_num;
                total_bp_fragment_num += bp_fragment_num;
                experience += experience_incr;
                if (fight_result) {
                    success += 1;
                    this.total_success += 1;
                } else {
                    fail += 1;
                    this.total_fail += 1;
                }

                // Change state in UI
                updateMetamonTable(monster, monster_table_idx, my_level, experience, init_tear - count - 1, progress_from_tear(init_tear - count - 1), success, total_bp_fragment_num);
            };
        };

        const curr_mtm_stats = {
            "metamon_id": my_monster_token_id,
            "league_level": battle_level,
            "battles": loop_count,
            "power": my_power,
            "experience": experience,
            "metamon_level": my_level,
            "rarity": monster.rarity,
            "won": success,
            "fragments": total_bp_fragment_num,
            "timestamp": Date.now()
        }
        this.mtm_stats.push(curr_mtm_stats);
    }
	
	async mintEggs () {
        // await this.init_token();

		const payload = {"address": this.address};
		let totalEggFragments = 0;

        // Check current egg fragments
		const bagRes = await fetch_loop(CHECK_BAG_URL, "post", urlencoded(payload), this.headersTokenAndCT());

		const items = bagRes.data.item; 
        for (const item of items) {
			if (item.bpType == 1) {
				totalEggFragments = item.bpNum;
				break;
			}
		}
        const totalEggs = parseInt(parseInt(totalEggFragments) / 1000);

		if (totalEggs < 1) 
			return 0;

		const res = await fetch_loop(MINT_EGG_URL, "post", urlencoded(payload), this.headersTokenAndCT());
		const code = res["code"];
		if (code != "SUCCESS")
			return 0;

        console.log("Minted Eggs Total: " + totalEggs);
        return totalEggs;
	}
	
	// Static methods
	
	/**
	Pick an opponent according to a given strategy ("weakest" or "random")
	 */
	static pickOpponent(monsters_list, strategy="weakest") {
	    let battlers = [];
		for (let monster of monsters_list) {
			if (monster["rarity"] == "N")
				battlers.push(monster);
		};
		
		if (battlers.length == 0) {
			for (let monster of monsters_list) {
				if (monster["rarity"] == "R")
					battlers.push(monster);
			};		
		};
	        
	
	    if (strategy == "weakest")
	        return MetamonIsland.pickOpponentWeakest(battlers);
		else if (strategy == "random")
	        return MetamonIsland.pickOpponentRandom(battlers);		
	};
	
	static pickOpponentRandom(battlers) {
	    return battlers[getRandomInt(len(battlers))];
	};
	
	static pickOpponentWeakest(battlers) {
	    let best_battler = battlers[0];
	    let score_min = best_battler["sca"];
	    
		for (let battler of battlers) {
	        if (battler["sca"] < score_min) {
	            best_battler = battler;
	            score_min = battler["sca"];
			};
		};
	    return best_battler;
	};
	
	/**
	Pick a battle league (currently there are 3!)
	 */
	static pickBattleLevel (level=1) {
	    if ((21 <= level) && (level <= 40)) {
	        return 2;
		} else if ((41 <= level) && (level <= 60)) {
	        return 3;
		}
		
	    return 1;
	};
};

let mi = null;
const MAX_TEAR = 20;

function progress_from_tear(tear) {
    return (MAX_TEAR - tear)*100.0/MAX_TEAR;
}

async function loadMetamons (address, sign, msg) {
    enable_submit_button(false);
    show_spinner(true);
    button_text("Loading...");

    let success = true;
    if (mi == null) {
        mi = new MetamonIsland(address, sign, msg);
        success = await mi.initToken();

        if (!success) {
            error_msg("Could not login to Metamon Island!", "danger");
        }
    }

    if (success) {
        const metamons = await mi.updateWallet();
        const progress = _.map(metamons, function (m) {return progress_from_tear(m.tear);});
        const wins = Array.from('-'.repeat(metamons.length));
        const fragments = Array.from('-'.repeat(metamons.length));

        fillMetamonTable(metamons, progress, wins, fragments);
    }

    enable_submit_button(true);
    show_spinner(false);
    button_text("Start battles!");
}

async function startBattles () {
    if (!mi)
        return;

    enable_submit_button(false);
    show_spinner(true);
    button_text("Battling...");

    const strategy = document.getElementById("strategy").value;
    const levelup = document.getElementById("levelup").checked;
    const minteggs = document.getElementById("minteggs").checked;
    const statistics = document.getElementById("statistics").checked;

    let metamons_to_play = [];
    let count = 0;
    for (let metamon of mi.metamons) {
        if (document.getElementById("mtm" + count).checked) {
            metamons_to_play.push(metamon);
        }
        count++;
    }

    const result = await mi.battle(metamons_to_play, strategy, levelup);

    if (result.length > 0) {
        const stats = result[0];
        const mtm_stats = result[1];
        
        stats.minted_eggs = 0;
        if (minteggs) {
            const minted_eggs = await mi.mintEggs();
            stats.minted_eggs = minted_eggs;
        }

        if (statistics)
            sendStats([stats, mtm_stats]);

        fillSummaryTable(stats);
        show_battle_results();
    }
    await mi.updateWallet();
    
    enable_submit_button(true);
    show_spinner(false);
    button_text("Start battles!");
}

async function sendStats(data) {
    await fetch('stats', {
        method: 'post',
        headers: {'Content-Type': 'application/json',
                  'X-CSRF-TOKEN': getCookie('csrf_access_token')},
        body: JSON.stringify(data)
    });
}

// User Interface

function fillMetamonTable (metamons, progress, wins, fragments) {
    const table_body = document.getElementById("metamon_table_body");

    let count = 0;
	for (let metamon of metamons) {
		// <tr>	
		const row = document.createElement('tr');

        // Checkbox
        row.insertAdjacentHTML("beforeend", '<td> <input id="mtm' + count + '" name="mtm' + count + '" type="checkbox" class="select-item checkbox form-check-input" checked> </td>');
        // Data: Token Id
        row.insertAdjacentHTML("beforeend", '<td>' + metamon.tokenId + ' </td>');
        // Data: Pic
        row.insertAdjacentHTML("beforeend", '<td> <img src="' + metamon.imageUrl  + '" alt="' + metamon.tokenId + '"></td>');
        // Data: Rarity
        row.insertAdjacentHTML("beforeend", '<td>' + metamon.rarity + '</td>');
        // Data: Power
        row.insertAdjacentHTML("beforeend", '<td>' + metamon.sca + '</td>');
        // Data: Level
        row.insertAdjacentHTML("beforeend", '<td>' + metamon.level + '<i>/' + metamon.levelMax + '</i></td>');
        // Data: Experience
        row.insertAdjacentHTML("beforeend", '<td>' + metamon.exp + '</td>');
        // Data: Experience
        row.insertAdjacentHTML("beforeend", '<td>' + metamon.tear + '<i>/20</i></td>');
        // Data: Progress bar
        let add_class = "";
        if (progress[count] == 100) {
            add_class = "progress_finished"
        };
        row.insertAdjacentHTML("beforeend", '<td> <div class="progress"> <div class="progress-bar ' + add_class + '" role="progressbar" style="width: ' + progress[count] + '%" aria-valuenow="' + progress[count] + '" aria-valuemin="0" aria-valuemax="100"></div></div></td>');
        // Data: Wins
        row.insertAdjacentHTML("beforeend", '<td>' + wins[count] + '</td>');
        // Data: Fragments
        row.insertAdjacentHTML("beforeend", '<td>' + fragments[count] + '</td>');

        // Append a new row to table
        table_body.appendChild(row);
        count++;
	}

    setCheckboxOnClickEvents();
};

function updateMetamonTable (metamon, monster_table_idx, level, experience, tear, progress, wins, fragments) {
    const table_body = document.getElementById("metamon_table_body");

    const tr_tag = table_body.getElementsByTagName("tr")[monster_table_idx];

    if (!tr_tag) {
        console.log(table_body, monster_table_idx, table_body.getElementsByTagName("tr").length);
    }

    const td_tags = tr_tag.getElementsByTagName("td");

    td_tags[5].innerHTML = level + '<i>/' + metamon.levelMax + '</i>';
    td_tags[6].innerHTML = String(experience);
    td_tags[7].innerHTML = tear + '<i>/' + MAX_TEAR + '</i>';
    let add_class = "";
    if (progress == 100) {
        add_class = "progress_finished"
    };
    td_tags[8].innerHTML = '<div class="progress"> <div class="progress-bar ' + add_class + '" role="progressbar" style="width: ' + progress + '%" aria-valuenow="' + progress + '" aria-valuemin="0" aria-valuemax="100"></div></div>';
    td_tags[9].innerHTML = String(wins);
    td_tags[10].innerHTML = String(fragments);
}

function fillSummaryTable (stats) {
    const table_body = document.getElementById("battle-results");

    const stats_list = [stats["won"] + stats["defeats"], stats["won"], stats["defeats"], (Math.round(stats["win_rate"] * 1000) / 10).toFixed(1) + "%", 
                        stats["fragments"], stats["minted_eggs"], stats["level_ups"]];
    const tr_tags = table_body.getElementsByTagName("tr");
    for (let n = 0 ; n < stats_list.length ; n++) {
        const td_tag = tr_tags[n].getElementsByTagName("td")[1];
        td_tag.innerHTML = String(stats_list[n]);
    }
};

function button_text (label) {
    document.getElementById("battle-submit-button-text").textContent = label;
}

function enable_submit_button (value) {
    document.getElementById("battle-submit-button").disabled = !value;
}

function show_spinner (value) {
    let str_val = value ? "" : "none";
    document.getElementById("battle-submit-button").getElementsByClassName("spinner-border")[0].style.display = str_val;
}

function show_battle_results () {
    document.getElementById("battle-submit-button").style.display = "block";
}

function setCheckboxOnClickEvents() {
    //column checkbox select all or cancel
    document.getElementsByClassName("select-all")[0].onclick = function() {
        var checked = this.checked;
        [].forEach.call(document.getElementsByClassName('select-item'), function(item, index) {
            item.checked = checked;
        });
    };

    //check selected items
    [].forEach.call(document.getElementsByClassName("select-item"), (item, index) => {
        item.onclick = function() {
            const checked = this.checked;
            let all = document.getElementsByClassName("select-all")[0];
            // number of boxes
            const total = document.getElementsByClassName("select-item").length;
            // number of checked boxes
            let num_checked = document.querySelectorAll('.select-item:checked').length;
            all.checked = num_checked===total;
        };
    });
};

var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
  return new bootstrap.Tooltip(tooltipTriggerEl)
})


window.loadMetamons = loadMetamons;
//window.startBattles = startBattles;
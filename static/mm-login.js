import { login } from './login-auth.js';
import { error_msg } from './utils.js';

const BSC_CHAIN_ID = 56;
let provider;

[].forEach.call(document.getElementsByClassName("metamask-login"), (item, index) => {
    item.onclick = async () => {
		login_metamask();
	}
});

document.addEventListener('DOMContentLoaded', init_Provider);

async function init_Provider() {
	provider = await detectEthereumProvider()
}

async function login_metamask() {
	if (provider) {
		try  {
			if (!await check_chain(provider)) {
				return false;
			}

			const wallet_address = await get_wallet_address(provider);
			await login(wallet_address, provider);
		}
		catch(error) {
			if (error.code == 4001) {
				error_msg("An error occurred. Try again and if the error persists, please contact me.", "danger");
			}
		}
	} else {
	  error_msg("Cannot find Metamask!", "danger");
	  return false;
	}
};

async function check_chain(provider)
{
	if (provider.chainId !== BSC_CHAIN_ID) {
		try {
		  	await provider.request({
				method: 'wallet_switchEthereumChain',
				params: [{ chainId: "0x38" }]
			});
		} catch (err) {
			// This error code indicates that the chain has not been added to MetaMask
			if (err.code === 4902) {
				try {
					await provider.request({
						method: 'wallet_addEthereumChain',
						params: [
							{
							chainName: 'Binance Chain',
							chainId: "0x38",
							nativeCurrency: { name: 'BNB', decimals: 18, symbol: 'BNB' },
							rpcUrls: ['https://bsc-dataseed.binance.org/']
							}
						]
					});
				}
				catch (err) {
					error_msg("You need to switch to Binance Chain to login!", "danger");
					return false;
				}
			}
		}
	}
    return true;
}

async function get_wallet_address(provider)
{
    try {
        let response = await provider.request({method: "eth_requestAccounts"});
        return response[0];
    } catch(e) {
        console.log(error);
        return 0;
    }
}
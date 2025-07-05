import 'dotenv/config';
import fs from 'fs';
import Web3 from 'web3';
import BigNumber from 'bignumber.js';
import axios from 'axios';
import { loginPharos } from './loginPharos.js';

const {
  RPC_URL,
  AMOUNT_TO_SEND,
  DELAY_MS = '3000',
  TASK_ID = '103',
  TX_DELAY_VERIFY = '10000',
  WALLET_GAP = '6000'
} = process.env;

const addresses = fs.readFileSync('addresses.txt', 'utf-8')
  .split('\n').map(a => a.trim()).filter(a => a.startsWith('0x'));

const wallets = fs.readFileSync('wallets.txt', 'utf-8')
  .split('\n').map(w => w.trim()).filter(Boolean);

const delay = ms => new Promise(r => setTimeout(r, ms));
const rand = (max = 3000) => Math.floor(Math.random() * max);
const log = (msg, file = 'log.txt') => fs.appendFileSync(file, msg + '\n');

async function verifyTask(jwt, senderAddr, txHash) {
  const url = `https://api.pharosnetwork.xyz/task/verify?address=${senderAddr}&task_id=${TASK_ID}&tx_hash=${txHash}`;
  const userAgents = [
  'Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/18.0 Chrome/96.0.4664.104 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 12_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15'
];

function getRandomUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

  const headers = {
    Authorization: `Bearer ${jwt}`,
    Referer: 'https://testnet.pharosnetwork.xyz',
    Origin: 'https://testnet.pharosnetwork.xyz',
    'User-Agent': getRandomUserAgent(),
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Content-Length': '0',
    'Sec-Fetch-Site': 'same-site',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    'Sec-CH-UA': '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
    'Sec-CH-UA-Platform': '"Android"',
    'Sec-CH-UA-Mobile': '?1',
  };

  const res = await axios.post(url, null, { headers });
  if (res.data.code !== 0) throw new Error(res.data.msg);
}

async function processWallet(PRIVATE_KEY, walletIndex) {
  const web3 = new Web3(RPC_URL);
  const sender = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
  web3.eth.accounts.wallet.add(sender);

  console.log(`\n🔑 Wallet [${walletIndex + 1}] ${sender.address}`);
  const jwt = await loginPharos(PRIVATE_KEY);
  const balance = await web3.eth.getBalance(sender.address);
  const amountWei = web3.utils.toWei(AMOUNT_TO_SEND, 'ether');
  const totalNeeded = new BigNumber(amountWei).multipliedBy(addresses.length);

  if (new BigNumber(balance).lt(totalNeeded)) {
    console.log(`❌ Saldo tidak cukup`);
    return;
  }

  let nonce = await web3.eth.getTransactionCount(sender.address, 'pending');
  const gasPrice = await web3.eth.getGasPrice();

  for (let i = 0; i < addresses.length; i++) {
    const to = addresses[i];
    try {
      const tx = {
        from: sender.address,
        to,
        value: amountWei,
        gas: 30000,
        gasPrice,
        nonce: nonce++
      };
      const receipt = await web3.eth.sendTransaction(tx);
      console.log(`✅ [W${walletIndex + 1} ${i + 1}/${addresses.length}] ${receipt.transactionHash}`);

      await delay(+TX_DELAY_VERIFY); // tunggu indexer
      await verifyTask(jwt, sender.address, receipt.transactionHash);
      console.log('   ↳ verified');

      log(`[${sender.address}] ✅ ${to} | ${receipt.transactionHash}`);
    } catch (err) {
      console.error(`❌ [${i + 1}] ${to} | ${err.message}`);
      log(`[${sender.address}] ❌ ${to} | ${err.message}`);
    }

    await delay(+DELAY_MS + rand());
  }
}

(async () => {
  for (let i = 0; i < wallets.length; i++) {
    try {
      await processWallet(wallets[i], i);
    } catch (err) {
      console.error(`❌ Wallet #${i + 1} gagal: ${err.message}`);
    }
    console.log(`🏁 Wallet #${i + 1} selesai. Menunggu ${WALLET_GAP}ms...`);
    await delay(+WALLET_GAP);
  }

  console.log('🎉 SEMUA WALLET SELESAI');
})();
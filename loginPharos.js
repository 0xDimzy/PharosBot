import { ethers } from 'ethers';
import axios from 'axios';
import 'dotenv/config';

const INVITE_CODE = process.env.INVITE_CODE || 'ZfcLFkTf2LzoJ3wQ';
const BASE_API = 'https://api.pharosnetwork.xyz';

export async function loginPharos(PK) {
  const wallet = new ethers.Wallet(PK);
  const address = wallet.address;
  const signature = await wallet.signMessage('pharos');

  const url = `${BASE_API}/user/login?address=${address}&signature=${signature}&invite_code=${INVITE_CODE}`;
  const response = await axios.post(url, null, {
    headers: {
      'Content-Type': 'application/json',
      Referer: 'https://testnet.pharosnetwork.xyz'
    }
  });

  const jwt = response?.data?.data?.jwt;
  if (!jwt) throw new Error('Login gagal: ' + response?.data?.msg);
  return jwt;
}

import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
const snarkjs = require("snarkjs");
const fs = require("fs");

import Rprovider from "../artifacts/contracts/RandomnessProvider.sol/RandomnessProvider.json"

describe("VDF", function () {

  async function fixture() {
   
    const [owner, otherAccount] = await ethers.getSigners();

    const verifier = await ethers.getContractFactory("Groth16Verifier");
    const verifierCont = await verifier.deploy()

    const vdf = await ethers.getContractFactory("RandomnessProvider");
    const randomnessProvider = await vdf.deploy(await verifierCont.getAddress());
    const randomnessProviderAddress = await randomnessProvider.getAddress()
    const randomnessConsumer = await ethers.getContractFactory("RandomnessConsumer")
    const randomnessConsumerContract = await randomnessConsumer.deploy(await randomnessProvider.getAddress()) 
    const randomnessConsumerAddress = await randomnessConsumerContract.getAddress()
    await randomnessProvider.fundContract(await randomnessConsumerContract.getAddress(),{value: ethers.parseEther("1")})
    return { randomnessConsumerContract, randomnessProvider,randomnessProviderAddress,randomnessConsumerAddress, owner, otherAccount,verifierCont };
  }

  describe("verification", function () {
    it("Should verify proof", async function () {
      const { randomnessConsumerContract, otherAccount, verifierCont } = await loadFixture(fixture);

      const { proof, publicSignals } = await snarkjs.groth16.fullProve({seed: "633766662137237634737665509633897276547394756039681606477126238171740081860"}, "circuits/circuit_js/circuit.wasm", "circuits/circuit_final.zkey");
      const vKey = JSON.parse(fs.readFileSync("circuits/verification_key.json"));

      const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      expect(res).eq(true)

    
      const tx = await verifierCont.verifyProof( [proof.pi_a[0], proof.pi_a[1]],
        [[proof.pi_b[0][1], proof.pi_b[0][0]],
        [proof.pi_b[1][1], proof.pi_b[1][0]]],
        [proof.pi_c[0], proof.pi_c[1]], publicSignals)
      expect(tx).eq(true)
    });

    it("Should verify proof using randomnessConsumer", async function () {
      const { randomnessConsumerContract, otherAccount,randomnessProvider } = await loadFixture(fixture);
      const contract = randomnessConsumerContract.connect(otherAccount)
      await contract.flipCoin(5,true);
      
      const seed = (await otherAccount.provider.getBlock("latest"))?.hash
      const n = BigInt(seed!)/BigInt("10")
      const n1 = n.toString()
    
      const { proof, publicSignals } = await snarkjs.groth16.fullProve({seed: n1}, "circuits/circuit_js/circuit.wasm", "circuits/circuit_final.zkey");
      const vKey = JSON.parse(fs.readFileSync("circuits/verification_key.json"));

      const res2 = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      expect(res2).eq(true)
   
      const proofs = parseProof(proof)
   
      // @ts-ignore12
      expect(await randomnessProvider.fullfilRandomness(1, proofs[0],proofs[1],proofs[2], publicSignals[0])).to.emit(randomnessConsumerContract,"GameOutcome").to.emit(randomnessProvider,"RandomnessFulfilled")
    });

    it("Should give reward to fullfillrandomness caller and decrease contract balance by same amount",async function(){
      const { randomnessConsumerContract, otherAccount,randomnessProvider,randomnessConsumerAddress, owner } = await loadFixture(fixture);
      const contract = randomnessConsumerContract.connect(otherAccount)
      await contract.flipCoin(5,true);
      
      const balanceBefore = await randomnessProvider.funding(randomnessConsumerAddress)
   
      const seed = (await otherAccount.provider.getBlock("latest"))?.hash
      const n = BigInt(seed!)/BigInt("10")
      const n1 = n.toString()
    
      const { proof, publicSignals } = await snarkjs.groth16.fullProve({seed: n1}, "circuits/circuit_js/circuit.wasm", "circuits/circuit_final.zkey");
      const proofs = parseProof(proof)
   
      // @ts-ignore12
      const tx = await randomnessProvider.fullfilRandomness(1, proofs[0],proofs[1],proofs[2], publicSignals[0])
      const res = await tx.wait()

      const inter = new ethers.Interface(Rprovider.abi)
   
      const balanceAfter = await randomnessProvider.funding(randomnessConsumerAddress)

    })
  });
});

function parseProof(proof: any){
  return  [
    [proof.pi_a[0], proof.pi_a[1]],
    [[proof.pi_b[0][1], proof.pi_b[0][0]],
    [proof.pi_b[1][1], proof.pi_b[1][0]]],
    [proof.pi_c[0], proof.pi_c[1]],
  ]
}
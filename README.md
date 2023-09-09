# VDF Solidity

This project utilizes iden3 [circom](https://docs.circom.io/) to create a zk circuit that implements a simple Verifiable Delay Function(VDF).

The circuit is then utilized to create a smart contract that verifies proofs and is utilized to create a service which takes requests
for randomness using as a seed the block hash of when the request was made. Then off chain the result of the VDF is computed with its respective zk proof.

Utilizing the zk proof anyone can perform a call to fulfill the randomness receiving a small fee for performing the computation and transaction. This way we can 
create an on chain RNG, without relying on third parties.

The circuit that implments the VDF can be found [here](/circuits/circuit.circom).
The randomness provider [contract](/contracts/RandomnessProvider.sol) and an example of how a [consumer](/contracts/helper/RandomnessConsumer.sol) can utilize it.

### Security
This code is just an example of how such a RNG could be made, and should not be used in any production systems.
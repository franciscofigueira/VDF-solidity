// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// Uncomment this line to use console.log
import "hardhat/console.sol";

interface IVerfier{
    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[2] calldata _pubSignals) external view returns (bool);
}

/**
*@title RandomnessProvider is a contract that other contracts can perform a request for a random number generated with the seed from the blockhash passed through VDF.
*/
contract RandomnessProvider{
    
    struct Request{
        address consumer;
        uint64 blockNumber;
        bool isPending;
    }
    uint256 private counter;
    address verifier;

    uint256 constant PREMIUM = 100000;

    mapping(uint256 => Request) public requests;
    mapping(address => uint256) public funding;

    event RandomnessRequested(address indexed consumer,uint256 indexed requestID, uint256 blocknumber);
    event RandomnessFulfilled(address indexed consumer, uint256 indexed requestID, uint256 fee);
    event ContractFunded(address indexed consumer, uint256 balance);

    error RequestNotPending();
    error InvalidProof();
    error ExternalCallFailed();
    error TansferFailed();
    error InsuficientFunds();

    constructor(address _verifier){
        verifier = _verifier;
      
    }

    /**
        @dev used to fund contracts that will consume random number, the amount funded is equal to the msg.value
        @param consumer address of the contract that will be the consumer
     */
    function fundContract(address consumer) external payable{
        funding[consumer] += msg.value;
        emit ContractFunded(consumer, funding[consumer]);
    }

    /**
        @dev used to remove funding from a contract, the caller must be the contract funded, and therefore should have the approriate functions to request and
        handle the removal of funds
        @param amount amount that will be removed
     */
    function removeFunding(uint256 amount) external{
        uint256 amountAvailable =  funding[msg.sender];
        require(amountAvailable >= amount);
        funding[msg.sender] -= amount;
        (bool success,) = payable(msg.sender).call{value:amount}("");
        require(success);
    }

    /**
        @dev function consumer must call to request random number
     */
    function requestRandom() external returns(uint256 id){
        counter ++;
        id = counter;

        requests[id] = Request(
            msg.sender,
            uint64(block.number),
            true
        );
  
        emit RandomnessRequested(msg.sender,id, block.number);
        return id;
    }

    /**
        @dev function used to fulfill the randmoness request, anyone can call this function and recive the reward for providing the random number
     */
    function fullfilRandomness(uint256 requestID ,uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint randomNumber) external{
        uint256 initialGas = gasleft();
        Request memory request = requests[requestID];
        if(!request.isPending){
            revert RequestNotPending();
        }
        requests[requestID].isPending = false;

        bool proof = IVerfier(verifier).verifyProof(_pA, _pB, _pC, [randomNumber, uint256(blockhash(request.blockNumber))/10]);
        if(!proof){
            revert InvalidProof();
        }

        (bool success, ) = request.consumer.call(
            abi.encodeWithSignature("fulfillRandomness(uint256,uint256)", requestID, randomNumber)
        );
        if(!success){
            revert ExternalCallFailed();
        }

        uint256 gasUsed = initialGas - gasleft();
        uint256 fee = (gasUsed + PREMIUM) * tx.gasprice;
        if(fee >  funding[request.consumer]){
            revert InsuficientFunds();
        }
        funding[request.consumer] -= fee;
        (bool success2,) = payable(msg.sender).call{value: fee}("");
        if(!success2){
            revert TansferFailed();
        }
   
        emit RandomnessFulfilled(request.consumer, requestID, fee);
    }   
}

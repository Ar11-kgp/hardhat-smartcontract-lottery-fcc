// Raffle or Lottery

// Enter the lottery (paying some amount)
// Pick a random winner (verifiably random)
// Einner to be selected every X minutes -> completly automated

// Since we r picking a random number and its a event driven execution,
// We need to use Chainlink Oracle -> to get the Randomness from outside the blockchain,
// Also we gonna need that Automated Execution and someone to trigger these
// To trigger, we will be using Chainlink Keepers

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";

error Raffle__NotEnoughETHEntered();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);

/** @title A sample Raffle Contract
 * @author Arya Rajendra
 * @notice This contract is for creating an untamperable decentralized smart contract
 * @dev This implements Chainlink VRF v2 and Chainlink Keepers
 */

abstract contract Raffle is VRFConsumerBaseV2, AutomationCompatibleInterface {
    /* Type Declarations */
    enum RaffleState {
        OPEN,
        CALCULATING
    } // we r secretly creating uint256, where 0=OPEN, 1=CALCULATING

    /* State Variables */
    uint256 private immutable i_entranceFee; // immutable variable to save gas
    address payable[] private s_players; // to keep a track of people enrolling. Has to be in stoarage as we gonna modify a lot
    // payable bcoz, as one of these players wins, we would have to pay them
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    // so that we declare it only once
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 1;

    // Lottery Variables
    address private s_recentWinner;
    RaffleState private s_raffleState; // to pending(0), open(1), closed(2), calculating(3)
    // better way is to use enums (used to create custom types with a finite set of 'constant values')
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;

    /*Events*/
    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    /* Functions */
    constructor(
        address vrfCoordinatorV2, // contract address -> we will have to deploy some mocks for this
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        // vrfCoordinator is the address of the contract taht does random no. verification
        // the entrance fee will be settable in our constructor
        i_entranceFee = entranceFee; // setting this onli one time so immutable
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval; // interval not gonna change after we set it
    }

    function enterRaffle() public payable {
        // as we want anyone to be entering our raffle (only if it is OPEN)
        // require (msg.value > i_entranceFee, "Not enuf ETH!")
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughETHEntered();
        }
        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__NotOpen();
        }
        // as someone enters the raffle, we will store him/her
        s_players.push(payable(msg.sender)); // as msg.sender is not a payable address, we have to typecast it

        // Events: whenever we update a dynamic obj like an array or a mapping, we always want to emit an event
        // Events allow u to "print" stuff to the logging structure in a way that's more gas efficient than actually saving it to storage var
        // Smart contracts can't access logs. Hence we can still print some info that's imp to use, without having to store it

        // Emit an event when we update a dynamic array or mapping
        // Named Events with the function name reversed
        emit RaffleEnter(msg.sender);
    }

    /**
     * @dev This is the function that the Chainlink Keeper nodes call
     * they look for the `upkeepNeeded` to return true.
     * The following should betrue in order to return true:
     * 1. Our time interval should have passed
     * 2. The lottery should have at least 1 player and have some ETH
     * 3. Our subscription is funded with LINK
     * 4. Lottery shud be in an "open" state.
     */

    function checkUpkeep(
        bytes memory /* checkData */ // changing from external to public so that even our own smart contracts can call this
    )
        public
        override
        returns (
            //external
            bool upkeepNeeded,
            bytes memory /* checkData */
        )
    {
        // checkData allows us to specify anything we want wen we call this func
        //which means, we can even specify this to call other functions
        bool isOpen = (RaffleState.OPEN == s_raffleState);
        // block.timestamp returns the current timestamp of the blockchain
        // time passed = block.timestamp - last block.timestamp, and this shud be > an interval (how long we want to wait betwn lottery runs)
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = (s_players.length > 0); // atleast 1 players has to be there
        bool hasBalance = address(this).balance > 0;
        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
    }

    /* wen we r waiting for a random number to return, and we have requested a random winner, we r technically in a state we are waiting for the no.
    and we shoudnt allow any new players to join. So what we actually do is create some state var telling us whether the lottery is "open" or not, and while 
    we are waitning for our random no. to get back, we will be in a close or calculating state */

    function performUpkeep(
        bytes calldata /*performData*/
    ) external override {
        // we wanna make sure this func only gets called wen checkUpKeep is true
        // updating the state so that other people can't join in while we re requesting a random no.
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Raffle__UpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_raffleState)
            );
        }
        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane, // gaslane: max price we willing to pay for a req, in wei
            i_subscriptionId, // subscription that we will need for funding our requests
            REQUEST_CONFIRMATIONS, // no. of confirmations Chainlink node shud wait befire responding
            i_callbackGasLimit, // gas limit for callback request to contract's fulfillRandomWords(). this sets a limit
            NUM_WORDS // how many random numbers we wanna get
        );
        emit RequestedRaffleWinner(requestId);
    }

    function pickRandomWinner() external {
        // external funcs are cheaper than public funcs
        // this func will be called by chainlink keepers network, so that it can automatically run
        // 1st we have to req the random number, and once we get it, do something with it
        // ChanlinkVRF is a 2 transaction process (so that nobody can manipulate the process)
    }

    function fulfillRandomWords(
        uint256,
        /* requestId */
        uint256[] memory randomWords
    ) internal override {
        // once we get that random no., we want to pick a random winner from our array of players
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_raffleState = RaffleState.OPEN;
        // After we pick a player from s_players, we need to reset our players array
        s_players = new address payable[](0);
        // everytime the winner is picked, we need to reset the timestamp as weel
        s_lastTimeStamp = block.timestamp;

        // now that we have the recent winner, we will send the moni to their contract
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        // require(success)
        if (!success) {
            revert Raffle__TransferFailed();
        }
        // creating an event to keep a history of winners
        emit WinnerPicked(recentWinner);
    }

    /* View/Pure Functions */
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee; // func that users cn call to get the entrance fee
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    function getNumWords() public view returns (uint256) {
        // return NUM_WORDS;
        return 1;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getLatestTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        // pure bcoz this is a constant func
        return REQUEST_CONFIRMATIONS;
    }
} // since NumWords is actually in the bytecode(const var) technically isn't reading from storage, hence can be a pure function
// returning NumWords doesn't actually read from storage, it will literally go and read the number 1

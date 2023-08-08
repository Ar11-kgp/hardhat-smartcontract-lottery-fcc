const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { experimentalAddHardhatNetworkMessageTraceHook } = require("hardhat/config")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", function () {
          let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval
          const chainId = network.config.chainId
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])
              raffle = await ethers.getContract("Raffle", deployer)
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
              reaffleEntranceFee = await raffle.getEntranceFee()
              interval = await raffle.getInterval()
          })
          describe("constructor", function () {
              it("initializes the raffle correctly", async function () {
                  // ideally we make our tests have ust 1 assert per "it"
                  // but we gonna have a bunch of them here (getting loose)
                  const raffleState = await raffle.getRaffleState()
                  const interval = await raffle.getInterval()
                  assert.equal(raffleState.toString(), "0") // raffleState returns 0 is OPEN, 1  is CALCULATING
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"]) // this shud equal whatever is there in our helper.config
              })
          })
          describe("enterRaffle", function () {
              it("reverts when you don't pay enough", async function () {
                  await expect(
                      raffle.enterRaffle().to.be.revertedWith("Raffle__NotEnoughETHEntered")
                  )
              })

              it("records players when they enter", async function () {
                  // as we enter the raffle, we gonna need the raffleEntranceFee
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  // we can make sure that our deployer has been correctly recorded
                  // as rn we r connected to the deployer, we will make sure the deployer is in our contract
                  const playerFromContract = await raffle.getPlayer(0)
                  assert.equal(playerFromContract, deployer)
              })

              it("emits event on enter", async function () {
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                      raffle,
                      "RaffleEnter"
                  )
              })

              it("doesn't allow entrance when raffle is calculating", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  // now we wanna get this raffle into CLOSED state. we need the checkUpkeep to return true so that performUpkeep can be called
                  // we will pretend to be the chainlink keeper network to keep calling checkUpkeep until its true
                  // once it is true, we will pretend to be chainlink keeper to call performUpkeep to put this contract in a state of CALCULATING
                  // For checkUpkeep to be true, raffle state shud be OPEN, next we need to wait for the time to pass
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  // so we r incrasing the time by whatever our interval is, to make sure that we can actually get that checkUpkeep to return TRUE
                  await network.provider.send("evm_mine", []) // bcoz we wanna mine one extra block
                  // we r pretending to be a chainlink keeper
                  await raffle.performUpkeep([]) // now it shud be in CALCULATING State
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith(
                      "Raffle__NotOpen"
                  )
              })
          })

          describe("checkUpkeep", function () {
              it("returns false if people have'nt sent any ETH", async function () {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  // await raffle.checkUpkeep([]) // as checkUpkeep is a public func, this line kicks off a transaction
                  // if it was public view, then it wouldn't. but we just wanna simulate sending this transaction
                  // nd seeing what this upkeepNeeded would return. we will get that using callstatic
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]) // extrapolating upkeepNeeded
                  assert(!upkeepNeeded) // bcoz rn upkeepNeeded shud return false. if it returns true then this will break
              })
              it("returns false if raffle isn't open", async function () {
                  // we have to make the raffle in CALCULATING state
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  await raffle.performUpkeep("0x") // another way to send 0 bytes
                  const raffleState = await raffle.getRaffleState()
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                  assert.equal(raffleState.toString(), "1") // 1 is for CALCULATING
                  assert.equal(upkeepNeeded, false)
              })
              it("returns false if enough time hasn't passed", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
                  assert(!upkeepNeeded)
              })
              it("returns true if enough time has passed, has players, ETH, and is OPEN", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
                  assert(upkeepNeeded)
              })
          })

          describe("performUpkeep", function () {
              it("can only run if checkUpkeep is true", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await raffle.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const tx = await raffle.performUpkeep([])
                  assert(tx) // if tx doesn't work, this will fail
              })

              // what else? we wanted to revert with Raffle__UpkeepNotNeeded if checkUpkeep==false
              it("reverts when checkUpkeep is false", async function () {
                  await expect(raffle.performUpkeep([])).to.be.revertedWith(
                      "Raffle__UpkeepNotNeeded"
                  )
              })
              it("updates the raffle state, emits and event, and calls the vrf coordinator", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee }) // rnter the raffle
                  await raffle.provider.send("evm_increaseTime", [interval.toNumber() + 1]) // increase the time
                  await network.provider.send("evm_mine", []) // mine a new block
                  const txResponse = await raffle.performUpkeep([]) // call performUpkeep
                  const txReceipt = await txResponse.wait(1)
                  const requestId = txReceipt.events[1].args.requestId
                  const raffleState = await raffle.getRaffleState()
                  assert(requestId.toNumber() > 0)
                  assert(raffleState.toString() == "1")
              })
          }) // Now the randomWords

          describe("fulfillRandomWords", function () {
              // we need to have someone to enter the raffle, increase the time nd mine a new block before we run any tests
              beforeEach(async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
              })
              it("can only be called after performUpkeep", async function () {
                  // here we gonna revert on some reqs that don't exist
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
                  ).to.be.revertedWith("nonexistence request")
                  // check fulfillRandomWords() in vrfCoordinatorV2Mock.sol
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
                  ).to.be.revertedWith("nonexistence request")
              })
              it("picks a winner, resets the lottery, and sends money", async function () {
                  // we gonna add some additonal entrances for this one
                  const additionalEntrants = 3 // no. of additional people who r entering the lottery
                  // we will more of those fake accs from ethers
                  const startingAccountIndex = 1 // since deployer=0, we will have new acc starting frm 1
                  const accounts = await ethers.getSigners()
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalEntrants;
                      i++
                  ) {
                      // we will have raffle contracts to connect to these accs nd enter our raffle contest
                      const accountConnectedRaffle = raffle.connect(accounts[i])
                      await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee }) // total 4 people will be connected
                  }
                  // we gonna keep note of our starting timestamp
                  const startingTimeStamp = await raffle.getLatestTimeStamp()

                  // performUpkeep (will mock being chainlink keepers) and will kickoff fulfillRandomWords()
                  // fulfillRandomWords (this will mock being Chainlink VRF)
                  // after this we have check if the conditions given in fulfillRandomWords have met/reset
                  // if we doing this on a testnet, then after fulfillRandomWords, we will have to wait for it to be called
                  // if we doing this on hardhat local chan, we don't have to wiat for anything

                  // in order to simulate waiting for that event to be called, we once again need to set up a listener
                  // we don't want this test to finish b4 the listener is done listening, hence we need to create a new promise
                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          // inside this promise, we r setting up a listener for this WinnerPicked event
                          console.log("Found the event!")
                          try {
                              // listener
                              const recentWinner = await raffle.getRecentWinner()
                              console.log(recentWinner)
                              console.log(accounts[2].address)
                              console.log(accounts[0].address)
                              console.log(accounts[1].address)
                              console.log(accounts[3].address)
                              // checking the winners

                              const raffleState = await raffle.getRaffleState()
                              const endingTimeStamp = await raffle.getLatestTimeStamp()
                              // assert: s_players array, raffleState has been reset to 0, ending>starting
                              const numPlayers = await raffle.getNumberOfPlayers()
                              const winnerEndingBalance = await accounts[1].getBalance()
                              assert.equal(numPlayers.toString(), "0")
                              assert.equal(raffleState.toString(), "0")
                              assert(endingTimeStamp > startingTimeStamp)

                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(
                                      raffleEntranceFee
                                          .mul(additionalEntrants)
                                          .add(raffleEntranceFee)
                                          .toString()
                                  )
                              )
                              // winner shud end with a balance of all the moni everyone else added to this contract
                          } catch (e) {
                              reject(e)
                          }
                          resolve() // if our event doesn't get fired in 200 sec, test will fail, which is wot we want
                      }) // we saying, once the WinnerPicked event gets emitted, do some stuff
                      // setting up the listener, below we will fire the event and the listener will pick it up nd resolve

                      const tx = await raffle.performUpkeep([]) // here we r mocking chainlink keepers
                      const txReceipt = await tx.wait(1) // nd chainlink VRF
                      const winnerStartingBalance = await accounts[1].getBalance()
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          // wen this func gets called, it shud emit the above event
                          tx.Receipt.events[1].args.requestId, // so that the raffle that was lsitening for this to get emitted will pick up
                          raffle.address // then go, "AH okay, I found the WinnerPicked event, now we can go ahead to do some stuff"
                      ) // check VRFCoordinatorV2Mock
                  })
              })
          })
      })

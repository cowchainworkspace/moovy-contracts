// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Moovy is ERC20Capped, Ownable, ReentrancyGuard {

  address constant private FOUNDERS = 0x3567969465d2135435e9318Ac278975472F62BAE;
  address constant private ADVISORS = 0x00781266C0e25bfd385685a5F4c1c9C9D0D47cDc;
  address constant private TEAM_MEMBERS = 0xA911361263eacC9579eaA29bF14056Ee887968DF;
  address constant private KOL_REWARDS = 0xf79a429DF39E4D102d689f977C9c2d0EB4478af0;
  address constant private PLAY_TO_EARN = 0x51fF21c11845c1C83A2e9D0C35852dA84fdA84D5;
  address constant private ECOSYSTEM = 0x0bA88421c5F99184F060daB9158A4cEfBcF1F3c1;
  address constant private POOL_REWARDS = 0x4236DB10650720DefaD8dC685c8Ce3266ed2247F;
  address constant private MARKETING = 0xAA2C53096aFd874B848e420173b9f7bE4Db16107;
  address constant private PARTNERSHIP_PROGRAM = 0x1Bc24f3b9Dd264fBC764e6d2B86B950fd0A9f709;

  uint8 constant public DECIMALS = 18;
  uint256 constant private MAX_BPS = 10000;
  uint256 constant private MAX_TOKEN_SUPPLY = 1_000_000_000 * 10**DECIMALS;

  uint256 constant private TOKEN_SALE_SUPPLY = 28_774_000 * 10**DECIMALS;

  uint256 public TGETimestamp;

  address private tokenSale;

  struct GroupData {
    uint256 cliff;
    uint256 vestingPeriod;
    address receiver;
    uint256 initialUnlock;
    uint256 balance;
    uint256 unlockedBalance;
  }

  enum AllocationGroup {
    Founders, Advisors, TeamMembers, KOLRewardsPool, PlayToEarn, EcosystemFund, PoolRewards, Marketing, Partnership
  }

  mapping (AllocationGroup => GroupData) public groups;

  event TGEPassed();
  event Distribute(AllocationGroup group, uint256 value);

  constructor() ERC20('MOIL', 'MOIL') ERC20Capped(MAX_TOKEN_SUPPLY) {
    groups[AllocationGroup.Founders].cliff = 2 * 30 days;
    groups[AllocationGroup.Founders].vestingPeriod = 7 * 30 days;
    groups[AllocationGroup.Founders].initialUnlock = 2000;
    groups[AllocationGroup.Founders].receiver = FOUNDERS;
    groups[AllocationGroup.Founders].balance = 100_000_000 * 10**DECIMALS;

    groups[AllocationGroup.Advisors].cliff = 5 * 30 days;
    groups[AllocationGroup.Advisors].vestingPeriod = 18 * 30 days;
    groups[AllocationGroup.Advisors].initialUnlock = 500;
    groups[AllocationGroup.Advisors].receiver = ADVISORS;
    groups[AllocationGroup.Advisors].balance = 20_000_000 * 10**DECIMALS;

    groups[AllocationGroup.TeamMembers].cliff = 4 * 30 days;
    groups[AllocationGroup.TeamMembers].vestingPeriod = 9 * 30 days;
    groups[AllocationGroup.TeamMembers].initialUnlock = 1000;
    groups[AllocationGroup.TeamMembers].receiver = TEAM_MEMBERS;
    groups[AllocationGroup.TeamMembers].balance = 30_000_000 * 10**DECIMALS;

    groups[AllocationGroup.KOLRewardsPool].cliff = 12 * 30 days;
    groups[AllocationGroup.KOLRewardsPool].vestingPeriod = 5 * 30 days;
    groups[AllocationGroup.KOLRewardsPool].initialUnlock = 1000;
    groups[AllocationGroup.KOLRewardsPool].receiver = KOL_REWARDS;
    groups[AllocationGroup.KOLRewardsPool].balance = 30_000_000 * 10**DECIMALS;

    groups[AllocationGroup.PlayToEarn].cliff = 0;
    groups[AllocationGroup.PlayToEarn].vestingPeriod = 6 * 30 days;
    groups[AllocationGroup.PlayToEarn].initialUnlock = 2500;
    groups[AllocationGroup.PlayToEarn].receiver = PLAY_TO_EARN;
    groups[AllocationGroup.PlayToEarn].balance = 355_000_000 * 10**DECIMALS;

    groups[AllocationGroup.EcosystemFund].cliff = 0;
    groups[AllocationGroup.EcosystemFund].vestingPeriod = 12 * 30 days;
    groups[AllocationGroup.EcosystemFund].initialUnlock = 2000;
    groups[AllocationGroup.EcosystemFund].receiver = ECOSYSTEM;
    groups[AllocationGroup.EcosystemFund].balance = 201_000_000 * 10**DECIMALS;

    groups[AllocationGroup.PoolRewards].cliff = 0;
    groups[AllocationGroup.PoolRewards].vestingPeriod = 0;
    groups[AllocationGroup.PoolRewards].initialUnlock = 10_000;
    groups[AllocationGroup.PoolRewards].receiver = POOL_REWARDS;
    groups[AllocationGroup.PoolRewards].balance = 70_000_000 * 10**DECIMALS;

    groups[AllocationGroup.Marketing].cliff = 9 * 30 days;
    groups[AllocationGroup.Marketing].vestingPeriod = 27 * 30 days;
    groups[AllocationGroup.Marketing].initialUnlock = 1500;
    groups[AllocationGroup.Marketing].receiver = MARKETING;
    groups[AllocationGroup.Marketing].balance = 144_726_000 * 10**DECIMALS;

    groups[AllocationGroup.Partnership].cliff = 3 * 30 days;
    groups[AllocationGroup.Partnership].vestingPeriod = 12 * 30 days;
    groups[AllocationGroup.Partnership].initialUnlock = 500;
    groups[AllocationGroup.Partnership].receiver = PARTNERSHIP_PROGRAM;
    groups[AllocationGroup.Partnership].balance = 20_500_000 * 10**DECIMALS;

  }

  function setTGEPassed() public onlyOwner {
    require(TGETimestamp == 0, "TGE is already passed");
    require(tokenSale != address(0), "Token sale is not settled");
    TGETimestamp = block.timestamp;

    _mint(tokenSale, TOKEN_SALE_SUPPLY);
    _mint(address(this), cap() - TOKEN_SALE_SUPPLY);

    emit TGEPassed();
  }

  function setTokenSale(address _tokenSale) external onlyOwner {
    tokenSale = _tokenSale;
  }

  function calculateVestingAmount(AllocationGroup _group) internal view returns (uint256) {
    GroupData memory group = groups[_group];

    uint256 initialUnlock = group.balance * group.initialUnlock / MAX_BPS;
    uint256 timePassed = (block.timestamp - group.cliff - TGETimestamp) > group.vestingPeriod ? group.vestingPeriod : (block.timestamp - group.cliff - TGETimestamp);
    uint256 pendingTokens = timePassed == 0 ? 0 : (group.balance - initialUnlock) * timePassed / group.vestingPeriod;
    uint256 availableTokens = initialUnlock + pendingTokens - group.unlockedBalance;

    return availableTokens;
  }

  function distribute(AllocationGroup group) public onlyOwner nonReentrant {
    require(block.timestamp >= (TGETimestamp + groups[group].cliff), "[distribute]: Distribution is not started yet");
    GroupData storage groupData = groups[group];
    uint256 vestingAmount = calculateVestingAmount(group);
    _transfer(address(this), groupData.receiver, vestingAmount);
    groupData.unlockedBalance += vestingAmount;

    emit Distribute(group, vestingAmount);
  }

}

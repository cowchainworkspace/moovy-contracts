// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./Moovy.sol";
import "hardhat/console.sol";

contract MoovyTokenSale is Ownable {

    struct AccountData {
        uint256 balance;
        uint256 unlockedBalance;
        uint256 index;
    }

    struct AccountPayload {
        address account;
        uint256 balance;
    }

    struct RoundData {
        address[] accountList;
        mapping(address => AccountData) accounts;
        uint256 cliff; // cliff period
        uint256 vestingPeriod;
        uint256 initialUnlock;
    }

    enum RoundType {
        Seed, Private, IGO
    }

    uint256 constant private MAX_BPS = 10000;
    mapping(RoundType => RoundData) roundData;

    Moovy immutable public token; // Moovy token
    ERC20 immutable public payToken; // token for payments
    uint256 immutable public pricePerToken;
    uint256 immutable public tokenSaleSupply;

    bool public isIGOStarted;
    uint256 public tokenSold;

    uint256 private _tokenSaleEndTimestamp;

    constructor (ERC20 _payToken, Moovy _token) {
        token = _token; // set SLT token address
        payToken = _payToken; // set token for payments
        pricePerToken = 37 * 10**_payToken.decimals() / 100;
        tokenSaleSupply = 28_774_000 * 10**_token.DECIMALS();

        roundData[RoundType.Seed].cliff = 2 * 30 days;
        roundData[RoundType.Seed].vestingPeriod = 8 * 30 days;
        roundData[RoundType.Seed].initialUnlock = 500;

        roundData[RoundType.Private].cliff = 1 * 30 days;
        roundData[RoundType.Private].vestingPeriod = 8 * 30 days;
        roundData[RoundType.Private].initialUnlock = 500;

        roundData[RoundType.IGO].cliff = 0 * 30 days;
        roundData[RoundType.IGO].vestingPeriod = 50 * 30 days;
        roundData[RoundType.IGO].initialUnlock = 4000;

    }

    function startIGO() external onlyOwner {
        isIGOStarted = true;
    }

    // buy tokens
    function buy(uint256 value) external {
        require(isIGOStarted, "[buy]: IGO is not started");
        require(_tokenSaleEndTimestamp != 0, "[buy]: token sale is ended");
        require(tokenSold + value <= tokenSaleSupply, "[buy]: max token supply exceeded");

        RoundData storage round = roundData[RoundType.IGO];
        address sender = msg.sender;

        uint256 requiredValue = value * pricePerToken / token.DECIMALS();

        payToken.transferFrom(sender, owner(), requiredValue);

        if (round.accounts[sender].balance == 0) {
            round.accounts[sender].index = round.accountList.length;
            round.accountList.push(sender);
        }

        round.accounts[sender].balance += value;
        tokenSold += value;

        if (tokenSold == tokenSaleSupply) {
            _tokenSaleEndTimestamp = block.timestamp;
        }
    }

    function addParticipants(RoundType _round, AccountPayload[] calldata accounts) external onlyOwner {
        RoundData storage round = roundData[_round];

        for (uint256 i; i < accounts.length;) {
            round.accounts[accounts[i].account].balance = accounts[i].balance;
            round.accounts[accounts[i].account].index = round.accountList.length;
            round.accountList.push(accounts[i].account);
            unchecked {
                i++;
            }
        }
    }


    // claim tokens
    function claim(RoundType round) external {
        address sender = msg.sender;
        uint256 vestingAmount = calculateVestingAmount(round, sender);
        bool success = token.transfer(sender, vestingAmount);
        require(success, 'invalid transfer');
        roundData[round].accounts[sender].unlockedBalance += vestingAmount;
    }

    function calculateVestingAmount(RoundType _round, address _account) internal view returns (uint256) {
        RoundData storage round = roundData[_round];
        AccountData memory account = round.accounts[_account];

        uint256 initialUnlock = account.balance * round.initialUnlock / MAX_BPS;
        uint256 timePassed = (block.timestamp - round.cliff - _tokenSaleEndTimestamp) > round.vestingPeriod ? round.vestingPeriod : (block.timestamp - round.cliff - _tokenSaleEndTimestamp);
        uint256 pendingTokens = (account.balance - initialUnlock) * timePassed / round.vestingPeriod;
        uint256 availableTokens = initialUnlock + pendingTokens - account.unlockedBalance;

        return availableTokens;
    }

}

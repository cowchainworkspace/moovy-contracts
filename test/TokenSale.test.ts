import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  MockToken,
  MockToken__factory,
  Moovy,
  Moovy__factory,
  MoovyTokenSale,
  MoovyTokenSale__factory
} from "../typechain";
import { ethers } from "hardhat";
import { beforeEach } from "mocha";
import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";

enum RoundType {
  Seed, Private, IGO
}

const increaseDate = async (days: number) => {
  await ethers.provider.send('evm_increaseTime', [days * 24 * 60 * 60]);
  await ethers.provider.send('evm_mine', []);
}
describe("TokenSale", () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let moovy: Moovy;
  let tokenSale: MoovyTokenSale;
  let usdt: MockToken;

  let moovy_factory: Moovy__factory;
  let tokenSale_factory: MoovyTokenSale__factory;
  let usdt_factory: MockToken__factory;

  before(async () => {
    moovy_factory = await ethers.getContractFactory("Moovy");
    tokenSale_factory = await ethers.getContractFactory("MoovyTokenSale");
    usdt_factory = await ethers.getContractFactory("MockToken");
  })

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();

    moovy = await moovy_factory.deploy();
    await moovy.deployed();

    usdt = await usdt_factory.deploy();
    await usdt.deployed();

    tokenSale = await tokenSale_factory.deploy(usdt.address, moovy.address);
    await tokenSale.deployed();

    await moovy.setTokenSale(tokenSale.address);
    await moovy.setTGEPassed();

    await usdt.transfer(alice.address, parseEther('100000000'));
    await usdt.transfer(bob.address, parseEther('100000000'));

    await usdt.approve(tokenSale.address, ethers.constants.MaxUint256);
    await usdt.connect(alice).approve(tokenSale.address, ethers.constants.MaxUint256);
    await usdt.connect(bob).approve(tokenSale.address, ethers.constants.MaxUint256);
  })

  describe("function buy", () => {
    it('should revert if igo is not started', async () => {
      await expect(tokenSale.buy(10)).revertedWith("[buy]: IGO is not started")
    })

    it('should revert if token supply exceded', async () => {
      await tokenSale.startIGO();
      await expect(tokenSale.buy(parseEther('100000000'))).revertedWith('[buy]: max token supply exceeded')
    })

    it('should revert if token sale is ended', async () => {
      await tokenSale.startIGO();
      await tokenSale.buy(parseEther('2774000'));
      await expect(tokenSale.buy(1)).revertedWith('[buy]: token sale is ended')
    })

    it('should revert if token sale is ended', async () => {
      await tokenSale.startIGO();
      await tokenSale.buy(parseEther('2774000'));
      await expect(tokenSale.buy(1)).revertedWith('[buy]: token sale is ended')
    })

    it('should buy tokens', async () => {
      await tokenSale.startIGO();
      const prevBalance = await usdt.balanceOf(alice.address);
      await tokenSale.connect(alice).buy(parseEther('5'));
      expect(await usdt.balanceOf(alice.address)).eq(prevBalance.sub(parseEther('1.85')))
      expect(await tokenSale.getAccountLockedBalance(RoundType.IGO, alice.address)).eq(parseEther('5'));
    })

    it('should buy tokens 2', async () => {
      await tokenSale.startIGO();
      const prevBalance = await usdt.balanceOf(alice.address);
      await tokenSale.connect(alice).buy(parseEther('0.1'));
      expect(await usdt.balanceOf(alice.address)).eq(prevBalance.sub(parseEther('0.037')))
      expect(await tokenSale.getAccountLockedBalance(RoundType.IGO, alice.address)).eq(parseEther('0.1'));
    })
  })

  describe('function addParticipants', () => {
    it('should revert if token sale is ended', async () => {
      await tokenSale.startIGO();
      await tokenSale.buy(parseEther('2774000'));
      await expect(tokenSale.addParticipants(RoundType.Seed, [{account: alice.address, balance: 1}])).revertedWith("[addParticipants]: token sale is ended");
    })

    it('should revert if round is not seed or private', async () => {
      await expect(tokenSale.addParticipants(RoundType.IGO, [{account: alice.address, balance: 1}])).revertedWith("[addParticipants]: you can add only to seed or private round");
    })

    it('should add participants', async () => {
      await tokenSale.addParticipants(RoundType.Seed, [{account: alice.address, balance: 1}, {account: bob.address, balance: 2}]);
      expect((await tokenSale.getRoundParticipants(RoundType.Seed)).length).eq(2)
    })
  })

  describe("function claim", () => {
    beforeEach(async () => {
      await tokenSale.addParticipants(RoundType.Seed, [{account: alice.address, balance: parseEther('100000')}, {account: bob.address, balance: parseEther('100000')}]);
      await tokenSale.addParticipants(RoundType.Private, [{account: alice.address, balance: parseEther('100000')}, {account: bob.address, balance: parseEther('100000')}]);
      await tokenSale.startIGO();
    })

    describe('claim seed', () => {
      beforeEach(async () => {
        await tokenSale.buy(parseEther('2774000'));
      })

      it('should claim cliff', async () => {
        await increaseDate(2 * 30);
        await tokenSale.connect(alice).claim(RoundType.Seed);
        expect(await moovy.balanceOf(alice.address)).closeTo(parseEther('5000'), parseEther('10'))
      })

      it('should claim all', async () => {
        await increaseDate(10 * 30);
        await tokenSale.connect(alice).claim(RoundType.Seed);
        expect(await moovy.balanceOf(alice.address)).eq(parseEther('100000'))
      })
    })

    describe('claim private', () => {
      beforeEach(async () => {
        await tokenSale.buy(parseEther('2774000'));
      })

      it('should claim cliff', async () => {
        await increaseDate(1 * 30);
        await tokenSale.connect(alice).claim(RoundType.Private);
        expect(await moovy.balanceOf(alice.address)).closeTo(parseEther('5000'), parseEther('10'))
      })

      it('should claim all', async () => {
        await increaseDate(9 * 30);
        await tokenSale.connect(alice).claim(RoundType.Private);
        expect(await moovy.balanceOf(alice.address)).eq(parseEther('100000'))
      })
    })

    describe('claim igo', () => {
      beforeEach(async () => {
        await tokenSale.connect(alice).buy(parseEther('4000'));
        await tokenSale.buy(parseEther('2770000'));
      })

      it('should claim cliff', async () => {
        await tokenSale.connect(alice).claim(RoundType.IGO);
        expect(await moovy.balanceOf(alice.address)).closeTo(parseEther('1600'), parseEther('10'))
      })

      it('should claim all', async () => {
        await increaseDate(5 * 30);
        await tokenSale.connect(alice).claim(RoundType.IGO);
        expect(await moovy.balanceOf(alice.address)).eq(parseEther('4000'))
      })
    })
  })

})
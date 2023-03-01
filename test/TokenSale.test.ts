import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ERC20, SLTToken, SLTTokenSale } from "../typechain";
import { expect } from 'chai';


const increaseDate = async (days: number) => {
  await ethers.provider.send('evm_increaseTime', [days * 24 * 60 * 60]);
  await ethers.provider.send('evm_mine', []);
}

describe('TokenSale', function () {
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  let SLTToken: SLTToken;
  let TokenSale: SLTTokenSale;
  let MockToken: ERC20;

  beforeEach(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    [owner, user1, user2] = signers;

    const factory = await ethers.getContractFactory('SLTToken');
    SLTToken = await factory.deploy();
    await SLTToken.deployed();

    const MockTokenFactory = await ethers.getContractFactory('MockToken');
    MockToken = await MockTokenFactory.deploy();
    await MockToken.deployed();

    const Lib = await ethers.getContractFactory("VestingStrategy");
    // @ts-ignore
    const lib = await Lib.deploy();
    await lib.deployed();

    const TokenSaleFactory = await ethers.getContractFactory('SLTTokenSale', {libraries: {VestingStrategy: lib.address}})
    TokenSale = await TokenSaleFactory.deploy(owner.address, MockToken.address, SLTToken.address)
    await TokenSale.deployed();

    await SLTToken.startTokenSale(TokenSale.address);
  });

  describe('buy', () => {
    beforeEach(async () => {
      await TokenSale.whitelist(0, [owner.address])
    })
    it('should revert if sale is not active', async () => {
      await expect(TokenSale.buy(1, 1)).to.be.revertedWith('sale is not active')
    });
    it('should revert if not whitelisted', async () => {
      await TokenSale.activeSale();
      await expect(TokenSale.connect(user1).buy(1, 1)).to.be.revertedWith('you are not whitelisted')
    });
    it('should revert if not enough payed', async () => {
      await TokenSale.activeSale();
      await expect(TokenSale.buy(ethers.utils.parseEther('1'), ethers.utils.parseEther('0.01'))).to.be.revertedWith('not enough payed')
    });
    it('should buy token', async () => {
      await TokenSale.activeSale();
      await MockToken.approve(TokenSale.address, ethers.utils.parseEther('0.06'));
      await TokenSale.buy(ethers.utils.parseEther('2'), ethers.utils.parseEther('0.06'));
    });
  });
  describe('whitelist', () => {
    it('should revert if invalid round', async () => {
      await expect(TokenSale.whitelist(3,[user1.address])).to.be.revertedWith('invalid round')
    })
  })
  describe('claim', () => {
    beforeEach(async () => {
      await TokenSale.activeSale();
    })
    describe('tge is not passed', () => {
      it('should revert if invalid', async () => {
        await expect(TokenSale.claim(4)).to.be.revertedWith('invalid round')
      })
      it('should revert if tge is not passed', async () => {
        await expect(TokenSale.claim(0)).to.be.revertedWith('tge is not passed')
      })
    })
    describe('tge is passed', () => {
      beforeEach(async () => {
        await TokenSale.whitelist(0, [owner.address])
        await MockToken.approve(TokenSale.address, ethers.utils.parseEther('120000'));
        await TokenSale.buy(ethers.utils.parseEther('4000000'), ethers.utils.parseEther('120000'));
      })
      it('should revert if balance is not unlocked', async () => {
        await expect(TokenSale.claim(0)).to.be.revertedWith('your balance is not unlocked')
      })
      it('should claim', async () => {
        await increaseDate(60);
        await TokenSale.claim(0);
        expect(await SLTToken.balanceOf(owner.address)).to.eq(ethers.utils.parseEther('400000'))
      })
    })
  })
});

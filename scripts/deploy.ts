import {ethers, run} from "hardhat";

async function main() {
  const moovy_factory = await ethers.getContractFactory("Moovy");
  const tokenSale_factory = await ethers.getContractFactory("MoovyTokenSale");
  const usdt_factory = await ethers.getContractFactory("MockToken");

  const moovy = await moovy_factory.deploy();
  await moovy.deployed();

  const usdt = await usdt_factory.deploy();
  await usdt.deployed();

  const tokenSale = await tokenSale_factory.deploy(usdt.address, moovy.address);
  await tokenSale.deployed();

  await (await moovy.setTokenSale(tokenSale.address)).wait();


  await run("verify:verify", {
    address: moovy.address,
    constructorArguments: [],
  });

  await run("verify:verify", {
    address: tokenSale.address,
    constructorArguments: [usdt.address, moovy.address],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

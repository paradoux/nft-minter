// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract NFTGenerator is ERC721URIStorage, Ownable, ReentrancyGuard {
  using Counters for Counters.Counter;

  // VARIABLES
  mapping(address => MintedNFT[]) mintedNFTs;
  Counters.Counter private _tokenIds;
  uint256 public mintingPrice;

  // STRUCTS
  struct MintedNFT {
    uint256 id;
    address creator;
    string tokenURI;
  }

  // EVENTS
  event NFTMinted(uint256 id, address creator, string tokenURI);
  event Received(address sender, uint256 amount);

  // MODIFIERS
  modifier checkPaidAmount {
    require(msg.value == mintingPrice, "Incorrect paid amount, check price");
    _;
  }

  constructor(uint256 initialMintingPrice) ERC721 ("MyCustomNFTCollection", "MCNFT") {
    mintingPrice = initialMintingPrice;
  }

  // BUSINESS LOGIC
  function generateNFT(string calldata tokenURI) payable public checkPaidAmount {
      require(bytes(tokenURI).length != 0, "tokenURI can't be empty");
      uint256 newItemId = _tokenIds.current();

      _safeMint(msg.sender, newItemId);

      _setTokenURI(newItemId, tokenURI);

      mintedNFTs[msg.sender].push(MintedNFT({
        id: newItemId,
        creator: msg.sender,
        tokenURI: tokenURI
      }));

      emit NFTMinted(newItemId, msg.sender, tokenURI);
      _tokenIds.increment();
  }

  function getUserNFTs() public view returns (MintedNFT[] memory) {
    return mintedNFTs[msg.sender];
  }


  // ADMIN FUNCTIONS
  function setPrice(uint256 newPrice) public onlyOwner {
    mintingPrice = newPrice;
  }

  function withdrawFunds(address payable receiver) public nonReentrant onlyOwner{
    Address.sendValue(receiver, address(this).balance);
  }

  // FALLBACKS
  // Called for empty calldata (and any value)
  receive() external payable {
      emit Received(msg.sender, msg.value);
  }

  // Called when no other function matches (not even the receive function)
  fallback() external payable {
      emit Received(msg.sender, msg.value);
  }
}
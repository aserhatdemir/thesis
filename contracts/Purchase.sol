pragma solidity ^0.4.11;


// this is a double escrow safe remote purchase contract, specific to each sale
contract Purchase {
  //state variables
  string public buyerPublicKey;
  uint public value;
  address public seller;
  address public buyer;
  string name;
  string description;
  string public demoHashAddress;
  string public contentHashAddress;
  enum State { Created, Locked, Inactive }
  // The state variable has a default value of the first member, `State.created`
  State public state;

  // Ensure that `msg.value` is an even number.
  // Division will truncate if it is an odd number.
  // Check via multiplication that it wasn't an odd number.
  /* function Purchase() public payable {
    seller = msg.sender;
    value = msg.value / 2;
    require((2 * value) == msg.value); //value has to be even
  } */

  modifier condition(bool _condition) {
    require(_condition);
    _;
  }

  modifier onlyBuyer() {
    require(msg.sender == buyer);
    _;
  }

  modifier onlySeller() {
    require(msg.sender == seller);
    _;
  }

  modifier inState(State _state) {
    require(state == _state);
    _;
  }

  /* //events
  event Aborted();
  event PurchaseConfirmed();
  event ItemReceived(); */

  // name can be changed to Content put up for sale
  event LogSellContent(
    address indexed _seller,   //indexed for search
    string _name,
    uint _value
    //delete unused parameters
  );

  event LogBuyContent(
    address indexed _seller,
    address indexed _buyer,
    string _name,
    uint _value
    //delete unused parameters
  );

  event LogUploadContent(
    address indexed _seller,
    string _name,
    string _contentHashAddress
  );

  event LogContentReceived(
    address indexed _buyer,
    string _name
  );

  event LogAborted(
    address indexed _seller,
    string _name
  );


  /// Abort the purchase and reclaim the ether.
  /// Can only be called by the seller before
  /// the contract is locked.
  function abort()
    public
    onlySeller
    inState(State.Created)
  {
    state = State.Inactive;
    seller.transfer(this.balance);

    LogAborted(seller, name);
  }

  /* /// Confirm the purchase as buyer.
  /// Transaction has to include `2 * value` ether.
  /// The ether will be locked until confirmReceived
  /// is called.
  function confirmPurchase()
    public
    inState(State.Created)
    condition(msg.value == (2 * value))
    payable
  {
    PurchaseConfirmed();
    buyer = msg.sender;
    state = State.Locked;
  } */

  /* /// Confirm that you (the buyer) received the item.
  /// This will release the locked ether.
  function confirmReceived()
    public
    onlyBuyer
    inState(State.Locked)
  {
    ItemReceived();
    // It is important to change the state first because
    // otherwise, the contracts called using `send` below
    // can call in again here.
    state = State.Inactive;

    // NOTE: This actually allows both the buyer and the seller to
    // block the refund - the withdraw pattern should be used.

    buyer.transfer(value);
    seller.transfer(this.balance);
  } */



  //changes the state of the blockchain,
  //this is why calling this function costs gas
  function sellContent(
    string _name,
    string _description,
    string _demoHashAddress,
    uint _value)
    payable
    public {
      seller = msg.sender;
      name = _name;
      description = _description;
      demoHashAddress = _demoHashAddress;
      value = _value;
      state = State.Created;

      LogSellContent(seller, name, value);
  }

  function buyContent(string _buyerPublicKey)
    inState(State.Created)
    condition(seller != 0x0)
    condition(msg.sender != seller)
    condition(msg.value == (2 * value))
    payable
    public {
      buyer = msg.sender;
      state = State.Locked;
      buyerPublicKey = _buyerPublicKey;

      LogBuyContent(seller, buyer, name, value);
  }

  function uploadContent(string _contentHashAddress)
    onlySeller
    inState(State.Locked)
    public {
      contentHashAddress = _contentHashAddress;

      LogUploadContent(seller, name, contentHashAddress);
  }

  /// Confirm that you (the buyer) received the item.
  /// This will release the locked ether.
  function confirmReceived()
    onlyBuyer
    inState(State.Locked)
    public {
    // It is important to change the state first because
    // otherwise, the contracts called using `send` below
    // can call in again here.
    state = State.Inactive;

    // NOTE: This actually allows both the buyer and the seller to
    // block the refund - the withdraw pattern should be used.

    buyer.transfer(value);
    seller.transfer(this.balance);

    LogContentReceived(buyer, name);
  }


  //does not change the state of the blockchain
  //does not cost gas, we call it as view.
  function getContent()
    public
    view
    returns (
      address _seller,
      address _buyer,
      string _name,
      string _description,
      string _demoHashAddress,
      uint _value,
      uint8 _state,
      string _contentHashAddress,
      string _buyerPublicKey
    ) {
      return(seller, buyer, name, description, demoHashAddress, value, uint8(state), contentHashAddress, buyerPublicKey);
    }
}

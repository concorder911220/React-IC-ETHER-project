use std::str::FromStr;

use candid::candid_method;
use ethers_core::{
    abi,
    types::{Address, RecoveryMessage, Signature},
};
//use ic_cdk::api::management_canister::http_request::HttpHeader;
//use ic_cdk::api::management_canister::http_request::TransformContext;
//use ic_cdk::api::management_canister::http_request::CanisterHttpRequestArgument;
use ic_cdk::api::management_canister::http_request::{
    http_request as make_http_request, CanisterHttpRequestArgument, HttpHeader, HttpMethod,
    HttpResponse, TransformArgs, TransformContext,
};

#[ic_cdk_macros::query]
#[candid_method]
pub fn verify_ecdsa(eth_address: String, message: String, signature: String) -> bool {
    Signature::from_str(&signature)
        .unwrap()
        .verify(
            RecoveryMessage::Data(message.into_bytes()),
            Address::from_str(&eth_address).unwrap(),
        )
        .is_ok()
}

//
// ?? whitelist / access control
// ?? cycles estimation (for HTTP outcall to RPC mech).
// 
//
// https://cloudflare-eth.com/v1/sepolia

#[ic_cdk_macros::update]
#[candid_method]
pub async fn getOwner(serviceUrl: String, nftContractAddress : String, tokenId : usize) -> String {
    // test:
    let service_url = serviceUrl;
    
    let f = abi::Function{
	name: "ownerOf".to_string(),
	inputs: vec![abi::Param{ name: "_tokenId".to_string(), kind: abi::ParamType::Uint(256), internal_type: None }],
	outputs: vec![abi::Param{ name: "".to_string(), kind: abi::ParamType::Address, internal_type: None }],
	constant: None,
	state_mutability: abi::StateMutability::View,
    };

    let data = hex::encode(f.encode_input(&[abi::Token::Uint(tokenId.into())]).expect("encode_input"));
   
    let params = format!(r#"[ {{ "to" : "0x{}", "data" : "0x{}" }}, "latest" ]"#, nftContractAddress, data);

    let json_rpc_payload =
        format!("{{\"jsonrpc\":\"2.0\",\"method\":\"eth_call\",\"params\":{},\"id\":1}}", params);
    let max_response_bytes = 2048;   

    let parsed_url = url::Url::parse(&service_url).expect("blah");
    let host = parsed_url.host_str().expect("blah").to_string();

    let request_headers = vec![
        HttpHeader {
            name: "Content-Type".to_string(),
            value: "application/json".to_string(),
        },
        HttpHeader {
            name: "Host".to_string(),
            value: host.to_string(),
        },
    ];
    let request = CanisterHttpRequestArgument {
        url: service_url,
        max_response_bytes: Some(max_response_bytes),
        method: HttpMethod::POST,
        headers: request_headers,
        body: Some(json_rpc_payload.as_bytes().to_vec()),
        transform: None,
    };
    let result = match make_http_request(request, 5000000).await {
        Ok((r,)) => r,
        Err((r, m)) => panic!("{:?} {:?}", r, m),
    };

    use serde::Deserialize;
    #[derive(Deserialize)]
    struct JSONRPCResult {
	result: String
    }
    let json: JSONRPCResult =
        serde_json::from_str(std::str::from_utf8(&result.body).expect("utf8")).expect("JSON was not well-formatted");
    json.result
}

#[ic_cdk_macros::query(name = "transform")]
fn transform(args: TransformArgs) -> HttpResponse {
    HttpResponse {
        status: args.response.status.clone(),
        body: args.response.body,
        // Strip headers as they contain the Date which is not necessarily the same
        // and will prevent consensus on the result.
        headers: Vec::<HttpHeader>::new(),
    }
}

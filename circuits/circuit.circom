pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

//Implemetation of a simple Verifiable delay function, the number of times the hash is performed can be adjust by changing N
template VDF(N){
    signal input seed;
    signal output out;

    component p[N];
    signal r[N];
    r[0] <== seed;
    for(var i = 0; i < N - 1; i++){
        p[i] = Poseidon(1);
        p[i].inputs[0] <== r[i];
        r[i+1] <== p[i].out;
    }
    out <== r[N - 1];
}

component main{public[seed]} = VDF(3);

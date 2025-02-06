from neuron import h, gui
h.nrnmpi_init()
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import time

print("Running neuron simulation")
start_time = time.time()

num_excitatory = 800
num_inhibitory = 200
total_neurons = num_excitatory + num_inhibitory
simulation_time = 1000
dt = 0.5

neurons = [h.Section(name=f'neuron_{i}') for i in range(total_neurons)]

for neuron in neurons:
    neuron.insert('hh')
    neuron.L = 50
    neuron.diam = 50

synapses = []
for i in range(total_neurons):
    for j in range(total_neurons):
        if i != j:
            syn = h.ExpSyn(neurons[j](0.5))
            if i < num_excitatory:
                syn.e = 0
                syn.tau = 2
            else:
                syn.e = -80
                syn.tau = 5
            nc = h.NetCon(neurons[i](0.5)._ref_v, syn, sec=neurons[i])
            nc.weight[0] = 0.05 if i < num_excitatory else 0.1
            nc.delay = 1
            synapses.append((syn, nc))

input_neurons = [0, 1]
output_neuron = -1

t = h.Vector().record(h._ref_t)
v_out = h.Vector().record(neurons[output_neuron](0.5)._ref_v)

h.finitialize(-65)
h.dt = dt
h.continuerun(simulation_time)

for input_neuron in input_neurons:
    stim = h.IClamp(neurons[input_neuron](0.5))
    stim.delay = 100
    stim.dur = 1
    stim.amp = 10

print("Running simulation")

h.run()

end_time = time.time()
print(f"Simulation time: {end_time - start_time} seconds")

print("Simulation completed")

plt.figure(figsize=(10, 6))
plt.plot(t, v_out)
plt.title('Output Neuron Membrane Potential')
plt.xlabel('Time (ms)')
plt.ylabel('Membrane Potential (mV)')
plt.grid(True)
plt.savefig('neuron_simulation_result.png')
